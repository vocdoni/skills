/**
 * Minimal client for `pi --mode rpc`.
 *
 * Protocol (verified against @mariozechner/pi-coding-agent v0.73.x):
 *  - We write exactly one JSON object per line to Pi's stdin (LF-terminated).
 *  - Pi writes strict LF-delimited JSONL to stdout: either a `{type:"response", id, …}`
 *    correlated to a command we sent, or an agent event (`agent_start`, `message_update`,
 *    `tool_execution_*`, `agent_end`, and runtime-only events such as `auto_retry_start`).
 *  - `agent_end` marks the end of an agent run.
 *
 * Framing detail: we split on "\n" ONLY (stripping a trailing "\r"). Payload strings may
 * legally contain other Unicode line separators (U+2028 / U+2029); a `readline`-style
 * reader would split on those and corrupt JSON. Hence the hand-rolled splitter below.
 */
import { StringDecoder } from "node:string_decoder";
import type { ChildProcess } from "node:child_process";
import { spawnProcess, terminate, hasExited, type SpawnFn } from "./safe-process";
import type { PiEvent, RpcResponse, RpcResponseSuccess, SessionState, ToolActivity } from "./types";

/** Incremental, LF-only JSONL splitter. Exposed for tests. */
export function createJsonlSplitter(onLine: (line: string) => void): {
  push: (chunk: Buffer | string) => void;
  end: () => void;
} {
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  const emit = (line: string): void => {
    onLine(line.endsWith("\r") ? line.slice(0, -1) : line);
  };
  return {
    push(chunk: Buffer | string): void {
      buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);
      let idx = buffer.indexOf("\n");
      while (idx !== -1) {
        emit(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 1);
        idx = buffer.indexOf("\n");
      }
    },
    end(): void {
      buffer += decoder.end();
      if (buffer.length > 0) {
        emit(buffer);
        buffer = "";
      }
    },
  };
}

/** Best-effort extraction of assistant text from a Pi message (shape-tolerant). */
export function extractAssistantText(message: unknown): string {
  if (message === null || typeof message !== "object") return "";
  const m = message as { content?: unknown; text?: unknown; role?: unknown };
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .map((block) => {
        if (block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") {
          return (block as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  if (typeof m.text === "string") return m.text;
  return "";
}

type RpcCommand = Record<string, unknown> & { type: string };

interface Pending {
  resolve: (response: RpcResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface PiRpcClientOptions {
  piPath: string;
  cwd: string;
  /** Extra CLI args appended after `--mode rpc` (e.g. --tools, --provider, --model). */
  args: readonly string[];
  env?: NodeJS.ProcessEnv;
  /** Called for every agent event (not responses). */
  onEvent?: (event: PiEvent) => void;
  /** Called for every raw stdout line and stderr chunk, for the task log. */
  onLog?: (entry: string) => void;
  /** Per-command response timeout (ack), ms. */
  commandTimeoutMs?: number;
  /** Injectable spawn for tests. */
  spawnImpl?: SpawnFn;
}

type EventListener = (event: PiEvent) => void;

export class PiRpcClient {
  private child?: ChildProcess;
  private readonly pending = new Map<string, Pending>();
  private readonly listeners = new Set<EventListener>();
  private requestId = 0;
  private stderrBuffer = "";
  private preview = "";
  private toolActivity: ToolActivity[] = [];
  private streaming = false;
  private exited = false;
  private exitInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null;

  constructor(private readonly options: PiRpcClientOptions) {}

  /** Spawn `pi --mode rpc <args>` and begin reading its output. */
  start(): void {
    const child = spawnProcess(
      this.options.piPath,
      ["--mode", "rpc", ...this.options.args],
      { cwd: this.options.cwd, env: this.options.env ?? process.env },
      this.options.spawnImpl,
    );
    this.child = child;

    const splitter = createJsonlSplitter((line) => this.handleLine(line));
    child.stdout?.on("data", (chunk: Buffer) => splitter.push(chunk));
    child.stdout?.on("end", () => splitter.end());
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      this.stderrBuffer += text;
      if (this.stderrBuffer.length > 64 * 1024) this.stderrBuffer = this.stderrBuffer.slice(-64 * 1024);
      this.options.onLog?.(`[stderr] ${text.trimEnd()}`);
    });
    child.on("error", (err) => this.failAll(err));
    child.on("exit", (code, signal) => {
      this.exited = true;
      this.exitInfo = { code, signal };
      this.streaming = false;
      this.failAll(new Error(`Pi process exited (code=${code ?? "null"}, signal=${signal ?? "null"})`));
    });
  }

  onEvent(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- commands -------------------------------------------------------------

  async prompt(message: string): Promise<void> {
    this.unwrap(await this.send({ type: "prompt", message }));
  }

  async steer(message: string): Promise<void> {
    this.unwrap(await this.send({ type: "steer", message }));
  }

  async followUp(message: string): Promise<void> {
    this.unwrap(await this.send({ type: "follow_up", message }));
  }

  async abort(): Promise<void> {
    try {
      this.unwrap(await this.send({ type: "abort" }));
    } catch {
      // aborting a non-running agent is fine
    }
  }

  async getState(): Promise<SessionState> {
    return this.unwrap<SessionState>(await this.send({ type: "get_state" }));
  }

  async getLastAssistantText(): Promise<string | null> {
    const data = this.unwrap<{ text: string | null }>(await this.send({ type: "get_last_assistant_text" }));
    return data?.text ?? null;
  }

  async getSessionStats(): Promise<unknown> {
    return this.unwrap(await this.send({ type: "get_session_stats" }));
  }

  async setAutoRetry(enabled: boolean): Promise<void> {
    try {
      this.unwrap(await this.send({ type: "set_auto_retry", enabled }));
    } catch {
      // older Pi builds may not support this; non-fatal
    }
  }

  // --- waiting / introspection ---------------------------------------------

  /** Resolve when the next `agent_end` arrives; reject on timeout or early exit. */
  waitForIdle(timeoutMs: number): Promise<void> {
    if (this.exited) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timer);
        unsubscribe();
        this.child?.off("exit", onExit);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for Pi to finish. ${this.stderrTail()}`));
      }, timeoutMs);
      const onExit = (): void => {
        cleanup();
        reject(new Error(`Pi process exited before completing. ${this.stderrTail()}`));
      };
      const unsubscribe = this.onEvent((event) => {
        if (event.type === "agent_end") {
          cleanup();
          resolve();
        }
      });
      this.child?.once("exit", onExit);
    });
  }

  isStreaming(): boolean {
    return this.streaming;
  }

  getPreview(): string {
    return this.preview;
  }

  getToolActivity(): ToolActivity[] {
    return this.toolActivity.slice(-10);
  }

  getStderr(): string {
    return this.stderrBuffer;
  }

  isAlive(): boolean {
    return !this.exited && this.child !== undefined && !hasExited(this.child);
  }

  async stop(): Promise<void> {
    this.failAll(new Error("client stopped"));
    if (this.child) await terminate(this.child);
  }

  // --- internals ------------------------------------------------------------

  private stderrTail(): string {
    const tail = this.stderrBuffer.trim().slice(-500);
    return tail ? `Stderr tail: ${tail}` : "";
  }

  private handleLine(line: string): void {
    if (line.trim() === "") return;
    this.options.onLog?.(line);
    let data: unknown;
    try {
      data = JSON.parse(line);
    } catch {
      this.options.onLog?.(`[unparsed] ${line}`);
      return;
    }
    if (!data || typeof data !== "object") return;
    const obj = data as Record<string, unknown>;

    if (obj.type === "response" && typeof obj.id === "string") {
      const waiter = this.pending.get(obj.id);
      if (waiter) {
        this.pending.delete(obj.id);
        clearTimeout(waiter.timer);
        waiter.resolve(obj as unknown as RpcResponse);
        return;
      }
    }
    this.dispatchEvent(obj as PiEvent);
  }

  private dispatchEvent(event: PiEvent): void {
    switch (event.type) {
      case "agent_start":
      case "turn_start":
      case "auto_retry_start":
        this.streaming = true;
        break;
      case "agent_end":
        this.streaming = false;
        break;
      case "message_update":
      case "message_end": {
        const text = extractAssistantText((event as { message?: unknown }).message);
        if (text) this.preview = text;
        break;
      }
      case "tool_execution_start":
        this.recordToolStart(event);
        break;
      case "tool_execution_end":
        this.recordToolEnd(event);
        break;
      default:
        break;
    }
    this.options.onEvent?.(event);
    for (const listener of this.listeners) listener(event);
  }

  private recordToolStart(event: PiEvent): void {
    const toolCallId = String((event as { toolCallId?: unknown }).toolCallId ?? "");
    const toolName = String((event as { toolName?: unknown }).toolName ?? "tool");
    let argsPreview: string | undefined;
    try {
      const args = (event as { args?: unknown }).args;
      if (args !== undefined) argsPreview = JSON.stringify(args).slice(0, 200);
    } catch {
      argsPreview = undefined;
    }
    const activity: ToolActivity = { toolCallId, toolName, status: "running" };
    if (argsPreview !== undefined) activity.argsPreview = argsPreview;
    this.toolActivity.push(activity);
    if (this.toolActivity.length > 50) this.toolActivity.shift();
  }

  private recordToolEnd(event: PiEvent): void {
    const toolCallId = String((event as { toolCallId?: unknown }).toolCallId ?? "");
    const isError = Boolean((event as { isError?: unknown }).isError);
    for (let i = this.toolActivity.length - 1; i >= 0; i--) {
      const activity = this.toolActivity[i];
      if (activity && activity.toolCallId === toolCallId) {
        activity.status = isError ? "error" : "done";
        return;
      }
    }
  }

  private send(command: RpcCommand): Promise<RpcResponse> {
    const child = this.child;
    if (!child || this.exited || !child.stdin) {
      return Promise.reject(new Error("Pi process is not running"));
    }
    const id = `req_${++this.requestId}`;
    const payload = `${JSON.stringify({ ...command, id })}\n`;
    return new Promise<RpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for response to '${command.type}'. ${this.stderrTail()}`));
      }, this.options.commandTimeoutMs ?? 30000);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin!.write(payload, (err) => {
        if (err) {
          const waiter = this.pending.get(id);
          if (waiter) {
            this.pending.delete(id);
            clearTimeout(waiter.timer);
            reject(err);
          }
        }
      });
    });
  }

  private unwrap<T>(response: RpcResponse): T {
    if (!response.success) {
      throw new Error(response.error || `Pi command '${response.command}' failed`);
    }
    return (response as RpcResponseSuccess).data as T;
  }

  private failAll(error: Error): void {
    for (const [, waiter] of this.pending) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.pending.clear();
  }
}
