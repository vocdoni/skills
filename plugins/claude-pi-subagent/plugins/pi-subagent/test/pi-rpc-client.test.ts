import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { createJsonlSplitter, extractAssistantText, PiRpcClient } from "../src/pi-rpc-client";

// Unicode line/paragraph separators, built from code points so the source file
// contains no ambiguous literal characters.
const LS = String.fromCharCode(0x2028); // U+2028 LINE SEPARATOR
const PS = String.fromCharCode(0x2029); // U+2029 PARAGRAPH SEPARATOR

// ---------------------------------------------------------------------------
// A controllable fake `pi --mode rpc` process.
// ---------------------------------------------------------------------------
class FakeChild extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  stdout = new PassThrough();
  stderr = new PassThrough();
  written: string[] = [];
  autoRespond = true;

  stdin = new Writable({
    write: (chunk: Buffer | string, _enc, cb) => {
      const text = chunk.toString();
      this.written.push(text);
      if (this.autoRespond) {
        for (const line of text.split("\n")) {
          if (line.trim() === "") continue;
          try {
            const cmd = JSON.parse(line) as { id?: string; type: string };
            if (cmd.id) this.respond(cmd);
          } catch {
            // ignore
          }
        }
      }
      cb();
    },
  });

  respond(cmd: { id?: string; type: string }): void {
    let data: unknown = {};
    if (cmd.type === "get_state") data = { isStreaming: false, pendingMessageCount: 0, sessionFile: "/tmp/s.jsonl" };
    else if (cmd.type === "get_last_assistant_text") data = { text: "final answer" };
    this.push({ type: "response", id: cmd.id, command: cmd.type, success: true, data });
  }

  push(obj: unknown): void {
    this.stdout.write(`${JSON.stringify(obj)}\n`);
  }

  kill(signal?: NodeJS.Signals): boolean {
    if (this.exitCode === null) {
      this.exitCode = 0;
      this.signalCode = signal ?? null;
      queueMicrotask(() => this.emit("exit", this.exitCode, this.signalCode));
    }
    return true;
  }
}

function makeClient(fake: FakeChild, overrides: Record<string, unknown> = {}): PiRpcClient {
  return new PiRpcClient({
    piPath: "pi",
    cwd: "/tmp",
    args: [],
    spawnImpl: () => fake as unknown as ChildProcess,
    commandTimeoutMs: 500,
    ...overrides,
  });
}

let active: PiRpcClient | undefined;
afterEach(async () => {
  if (active) await active.stop();
  active = undefined;
});

// ---------------------------------------------------------------------------
// JSONL framing — the core protocol requirement.
// ---------------------------------------------------------------------------
describe("createJsonlSplitter", () => {
  it("keeps raw U+2028 / U+2029 inside JSON strings (splits on \\n only)", () => {
    const lines: string[] = [];
    const splitter = createJsonlSplitter((l) => lines.push(l));
    // Build the wire line by hand so the separators are RAW, not escaped.
    // A readline-style reader would split on LS/PS and corrupt this record.
    const rawLine = `{"text":"a${LS}b${PS}c","ok":true}`;
    splitter.push(`${rawLine}\n`);

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as { text: string; ok: boolean };
    expect(parsed.text).toBe(`a${LS}b${PS}c`);
    expect(parsed.ok).toBe(true);
  });

  it("does not treat U+2028 / U+2029 as line boundaries", () => {
    const lines: string[] = [];
    const splitter = createJsonlSplitter((l) => lines.push(l));
    splitter.push(`{"x":"a${LS}b${PS}c"}\n`);
    expect(lines).toHaveLength(1);
    expect((JSON.parse(lines[0]!) as { x: string }).x).toBe(`a${LS}b${PS}c`);
  });

  it("strips a trailing CR and handles chunk boundaries", () => {
    const lines: string[] = [];
    const splitter = createJsonlSplitter((l) => lines.push(l));
    splitter.push('{"a":1}\r\n{"b":');
    splitter.push("2}\n");
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("decodes multi-byte UTF-8 split across chunk boundaries", () => {
    const lines: string[] = [];
    const splitter = createJsonlSplitter((l) => lines.push(l));
    const buf = Buffer.from('{"e":"é"}\n', "utf8");
    const cut = buf.indexOf(0xa9); // second byte of "é" (0xC3 0xA9)
    splitter.push(buf.subarray(0, cut));
    splitter.push(buf.subarray(cut));
    expect(JSON.parse(lines[0]!)).toEqual({ e: "é" });
  });

  it("flushes a trailing unterminated line on end()", () => {
    const lines: string[] = [];
    const splitter = createJsonlSplitter((l) => lines.push(l));
    splitter.push('{"final":true}');
    splitter.end();
    expect(lines).toEqual(['{"final":true}']);
  });
});

describe("extractAssistantText", () => {
  it("reads string and block-array content shapes", () => {
    expect(extractAssistantText({ content: "hello" })).toBe("hello");
    expect(extractAssistantText({ content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] })).toBe("ab");
    expect(extractAssistantText({ text: "fallback" })).toBe("fallback");
    expect(extractAssistantText(null)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Request/response correlation and completion.
// ---------------------------------------------------------------------------
describe("PiRpcClient", () => {
  it("correlates a command with its response", async () => {
    const fake = new FakeChild();
    const client = (active = makeClient(fake));
    client.start();
    await expect(client.prompt("do a thing")).resolves.toBeUndefined();
    const state = await client.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.sessionFile).toBe("/tmp/s.jsonl");
  });

  it("resolves waitForIdle on agent_end and tracks preview + tool activity", async () => {
    const fake = new FakeChild();
    const client = (active = makeClient(fake));
    client.start();

    const idle = client.waitForIdle(1000);
    fake.push({ type: "agent_start" });
    fake.push({ type: "message_update", message: { role: "assistant", content: [{ type: "text", text: "partial" }] } });
    fake.push({ type: "tool_execution_start", toolCallId: "t1", toolName: "read", args: { path: "a.ts" } });
    fake.push({ type: "tool_execution_end", toolCallId: "t1", toolName: "read", result: {}, isError: false });
    fake.push({ type: "agent_end", messages: [] });

    await expect(idle).resolves.toBeUndefined();
    expect(client.getPreview()).toBe("partial");
    expect(client.getToolActivity().at(-1)).toMatchObject({ toolName: "read", status: "done" });
  });

  // ---- Task timeout behavior with a mocked Pi process ----
  it("times out waiting for idle when no agent_end arrives", async () => {
    const fake = new FakeChild();
    fake.autoRespond = false;
    const client = (active = makeClient(fake));
    client.start();
    await expect(client.waitForIdle(60)).rejects.toThrow(/waiting for Pi to finish/);
  });

  it("rejects pending work when the process exits early", async () => {
    const fake = new FakeChild();
    fake.autoRespond = false;
    const client = (active = makeClient(fake));
    client.start();
    const idle = client.waitForIdle(1000);
    fake.kill("SIGTERM");
    await expect(idle).rejects.toThrow(/exited before completing/);
  });
});
