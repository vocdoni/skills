/**
 * Task lifecycle manager: spawns Pi per task, isolates it in a worktree, drives the
 * run to completion, captures a diff, and exposes status/result/steer/follow-up/cancel.
 *
 * One task == one Pi process. The process is kept alive after a successful run so the
 * caller can follow up on the same session; it is killed on cancel, cleanup, timeout,
 * failure, or server shutdown. Concurrency is bounded by `maxParallel` active runs.
 */
import { randomUUID } from "node:crypto";
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { discoverAgents, planAgentRun, type AgentDef } from "./agents";
import type { Config } from "./config";
import { applyPatch, realGitRunner, repoRoot } from "./git";
import { assertFileInProject, taskDir as taskDirFor } from "./paths";
import { PiRpcClient } from "./pi-rpc-client";
import {
  buildTaskResult,
  DEFAULT_MAX_DIFF_CHARS,
  truncate,
  type ResultRecord,
} from "./result-format";
import { resolveTools } from "./schemas";
import type { ChangedFile, SessionState, TaskMode, TaskResult, TaskStatus, ToolActivity } from "./types";
import { collectResults, setupWorkspace, teardownWorktree, type Workspace } from "./worktree";

export interface StartTaskParams {
  task: string;
  mode?: TaskMode;
  files?: string[];
  tools?: string[];
  provider?: string;
  model?: string;
  thinking?: string;
  useWorktree?: boolean;
  timeoutSeconds?: number;
  maxDiffChars?: number;
}

export interface RunAgentParams {
  agent: string;
  input: string;
  model?: string;
  thinking?: string;
  useWorktree?: boolean;
  timeoutSeconds?: number;
  maxDiffChars?: number;
  background?: boolean;
}

export interface AgentSummary {
  name: string;
  description?: string;
  model?: string;
  tools?: string[];
  source: string;
}

/** Internal description of a single Pi run, shared by task and agent launches. */
interface RunSpec {
  mode: TaskMode;
  agentName?: string;
  /** The prompt message; a function receives the resolved working directory. */
  message: string | ((cwd: string) => string);
  tools: string[];
  provider?: string;
  model?: string;
  thinking: string;
  systemPrompt?: { text: string; mode: "replace" | "append" };
  useWorktree: boolean;
  timeoutMs: number;
  maxDiffChars: number;
  logHeaderExtra?: string;
}

export interface TaskStatusReport {
  taskId: string;
  status: TaskStatus;
  mode: TaskMode;
  agentName?: string;
  isStreaming: boolean;
  elapsedMs: number;
  preview: string;
  recentTools: ToolActivity[];
  changedFileCount: number;
  worktreePath?: string;
  logPath: string;
  resultPath: string;
  error?: string;
}

export interface TaskSummary {
  taskId: string;
  status: TaskStatus;
  mode: TaskMode;
  agentName?: string;
  changedFileCount: number;
  startedAt: string;
  endedAt?: string;
  worktreePath?: string;
}

interface ManagedTask {
  record: ResultRecord;
  dir: string;
  client: PiRpcClient;
  workspace: Workspace;
  logStream: WriteStream;
  running: boolean;
  startedAtMs: number;
  maxDiffChars: number;
  completion?: Promise<void>;
  /** Idle-reaper timer: terminates the Pi process after completedTtlSeconds of no follow-up. */
  reapTimer?: ReturnType<typeof setTimeout>;
}

const TERMINAL: readonly TaskStatus[] = ["completed", "failed", "cancelled", "timeout"];

export class PiTaskManager {
  private readonly tasks = new Map<string, ManagedTask>();
  private activeRuns = 0;

  constructor(private readonly config: Config) {}

  // --- public API -----------------------------------------------------------

  async runTask(params: StartTaskParams): Promise<TaskResult> {
    return this.launch(params, true);
  }

  async startTask(params: StartTaskParams): Promise<TaskResult> {
    return this.launch(params, false);
  }

  /** Run a named pi-agent against a caller-supplied input. */
  async runAgent(params: RunAgentParams): Promise<TaskResult> {
    const spec = await this.buildAgentSpec(params);
    return this.startManagedRun(spec, !params.background);
  }

  /** List the discoverable named pi-agents. */
  async listAgents(): Promise<AgentSummary[]> {
    const agents = await discoverAgents(this.config.agentsDirs);
    return [...agents.values()].map((agent) => {
      const summary: AgentSummary = { name: agent.name, source: agent.source };
      if (agent.description !== undefined) summary.description = agent.description;
      if (agent.model !== undefined) summary.model = agent.model;
      if (agent.tools !== undefined) summary.tools = agent.tools;
      return summary;
    });
  }

  getStatus(taskId: string): TaskStatusReport {
    const task = this.require(taskId);
    const report: TaskStatusReport = {
      taskId,
      status: task.record.status,
      mode: task.record.mode,
      isStreaming: task.client.isStreaming(),
      elapsedMs: Date.now() - task.startedAtMs,
      preview: truncate(task.client.getPreview(), 1500).text,
      recentTools: task.client.getToolActivity(),
      changedFileCount: task.record.changedFiles.length,
      logPath: task.record.logPath,
      resultPath: task.record.resultPath,
    };
    if (task.record.agentName !== undefined) report.agentName = task.record.agentName;
    if (task.record.worktreePath !== undefined) report.worktreePath = task.record.worktreePath;
    if (task.record.error !== undefined) report.error = task.record.error;
    return report;
  }

  getResult(taskId: string, maxDiffChars?: number): TaskResult {
    const task = this.require(taskId);
    return buildTaskResult(task.record, maxDiffChars ?? task.maxDiffChars);
  }

  async steer(taskId: string, message: string): Promise<{ taskId: string; steered: boolean }> {
    const task = this.require(taskId);
    if (!task.client.isAlive()) throw new Error(`Task ${taskId} is no longer running; cannot steer.`);
    if (task.record.status !== "running") {
      throw new Error(`Task ${taskId} is '${task.record.status}', not running. Use pi_follow_up instead.`);
    }
    await task.client.steer(message);
    return { taskId, steered: true };
  }

  async followUp(
    taskId: string,
    message: string,
    timeoutSeconds?: number,
    maxDiffChars?: number,
  ): Promise<TaskResult> {
    const task = this.require(taskId);
    if (!task.client.isAlive()) {
      throw new Error(`Task ${taskId}'s Pi session has ended; start a new task instead.`);
    }

    // Still running → queue a follow-up message and return the live snapshot.
    if (task.record.status === "running") {
      await task.client.followUp(message);
      return buildTaskResult(task.record, maxDiffChars ?? task.maxDiffChars);
    }

    // Idle → re-open a run on the same session. Cancel any pending idle reaper first.
    if (task.reapTimer) {
      clearTimeout(task.reapTimer);
      task.reapTimer = undefined;
    }
    this.assertCapacity();
    task.record.status = "running";
    delete task.record.error;
    delete task.record.endedAt;
    task.running = true;
    this.activeRuns += 1;
    task.startedAtMs = Date.now();
    if (maxDiffChars !== undefined) task.maxDiffChars = maxDiffChars;
    task.logStream.write(`\n# follow-up: ${message}\n`);
    void this.writeResult(task);

    try {
      await task.client.prompt(message);
    } catch (err) {
      await this.finalizeFailure(task, err);
      return buildTaskResult(task.record, task.maxDiffChars);
    }
    const timeoutMs = (timeoutSeconds ?? this.config.defaultTimeoutSeconds) * 1000;
    task.completion = this.awaitCompletion(task, timeoutMs);
    await task.completion;
    return buildTaskResult(task.record, task.maxDiffChars);
  }

  async cancel(taskId: string): Promise<TaskResult> {
    const task = this.require(taskId);
    if (!TERMINAL.includes(task.record.status)) {
      task.record.status = "cancelled";
      task.record.error = task.record.error ?? "Cancelled by user.";
      task.record.endedAt = new Date().toISOString();
    }
    try {
      await task.client.abort();
    } catch {
      // ignore
    }
    await this.captureDiff(task);
    this.releaseRun(task);
    await task.client.stop();
    await this.writeResult(task);
    return buildTaskResult(task.record, task.maxDiffChars);
  }

  listTasks(): TaskSummary[] {
    return [...this.tasks.values()].map((task) => {
      const summary: TaskSummary = {
        taskId: task.record.taskId,
        status: task.record.status,
        mode: task.record.mode,
        changedFileCount: task.record.changedFiles.length,
        startedAt: task.record.startedAt,
      };
      if (task.record.agentName !== undefined) summary.agentName = task.record.agentName;
      if (task.record.endedAt !== undefined) summary.endedAt = task.record.endedAt;
      if (task.record.worktreePath !== undefined) summary.worktreePath = task.record.worktreePath;
      return summary;
    });
  }

  async cleanup(taskId?: string, removeWorktree = true): Promise<{ cleaned: string[]; skipped: string[] }> {
    const targets = taskId ? [this.require(taskId)] : [...this.tasks.values()];
    const cleaned: string[] = [];
    const skipped: string[] = [];
    for (const task of targets) {
      if (task.running) {
        if (taskId) throw new Error(`Task ${taskId} is still running. Cancel it first with pi_cancel.`);
        skipped.push(task.record.taskId);
        continue;
      }
      await task.client.stop();
      task.logStream.end();
      if (removeWorktree) {
        const opts: { projectDir: string; worktreePath?: string } = { projectDir: this.config.projectDir };
        if (task.record.worktreePath !== undefined) opts.worktreePath = task.record.worktreePath;
        await teardownWorktree(opts);
        await rm(task.dir, { recursive: true, force: true }).catch(() => undefined);
      }
      this.tasks.delete(task.record.taskId);
      cleaned.push(task.record.taskId);
    }
    return { cleaned, skipped };
  }

  async applyResult(taskId: string): Promise<{ taskId: string; applied: boolean; changedFiles: ChangedFile[] }> {
    const task = this.require(taskId);
    if (task.record.status !== "completed") {
      throw new Error(`Task ${taskId} is '${task.record.status}'. Only completed tasks can be applied.`);
    }
    if (!task.record.diffPath || task.record.changedFiles.length === 0) {
      throw new Error(`Task ${taskId} produced no diff to apply.`);
    }
    let applyDir = this.config.projectDir;
    try {
      applyDir = await repoRoot(this.config.projectDir, realGitRunner);
    } catch {
      // fall back to project dir
    }
    await applyPatch(applyDir, task.record.diffPath);
    return { taskId, applied: true, changedFiles: task.record.changedFiles };
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      [...this.tasks.values()].map(async (task) => {
        try {
          await task.client.stop();
        } catch {
          // ignore
        }
        task.logStream.end();
      }),
    );
  }

  // --- internals ------------------------------------------------------------

  private require(taskId: string): ManagedTask {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Unknown task id: ${taskId}`);
    return task;
  }

  private assertCapacity(): void {
    if (this.activeRuns >= this.config.maxParallel) {
      const running = [...this.tasks.values()].filter((t) => t.running).map((t) => t.record.taskId);
      throw new Error(
        `Max parallel tasks (${this.config.maxParallel}) reached. Running: ${running.join(", ") || "none"}. ` +
          `Wait for one to finish, or cancel one with pi_cancel.`,
      );
    }
  }

  private createId(): string {
    return `pi-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  }

  private async launch(params: StartTaskParams, wait: boolean): Promise<TaskResult> {
    const mode: TaskMode = params.mode ?? "ask";
    const tools = resolveTools(mode, params.tools);
    const files = (params.files ?? []).map((f) => {
      assertFileInProject(this.config.projectDir, f);
      return f;
    });
    const provider = params.provider ?? this.config.defaultProvider;
    const model = params.model ?? this.config.defaultModel;
    const spec: RunSpec = {
      mode,
      tools,
      thinking: params.thinking ?? this.config.defaultThinking,
      useWorktree: params.useWorktree ?? this.config.useWorktrees,
      timeoutMs: (params.timeoutSeconds ?? this.config.defaultTimeoutSeconds) * 1000,
      maxDiffChars: params.maxDiffChars ?? DEFAULT_MAX_DIFF_CHARS,
      message: (cwd) => buildPiPrompt({ mode, projectDir: this.config.projectDir, cwd, files, task: params.task }),
      logHeaderExtra: `files=${files.join(",") || "(none)"}`,
    };
    if (provider) spec.provider = provider;
    if (model) spec.model = model;
    return this.startManagedRun(spec, wait);
  }

  private async buildAgentSpec(params: RunAgentParams): Promise<RunSpec> {
    const agents = await discoverAgents(this.config.agentsDirs);
    const agent = agents.get(params.agent);
    if (!agent) {
      const available = [...agents.keys()].sort().join(", ") || "(none)";
      throw new Error(
        `Unknown pi-agent '${params.agent}'. Available: ${available}. ` +
          `Searched: ${this.config.agentsDirs.join(", ")}.`,
      );
    }

    const plan = planAgentRun(agent, params, {
      defaultModel: this.config.defaultModel,
      defaultThinking: this.config.defaultThinking,
      useWorktrees: this.config.useWorktrees,
    });

    const spec: RunSpec = {
      mode: plan.mode,
      agentName: agent.name,
      tools: plan.tools,
      model: plan.model,
      thinking: plan.thinking,
      systemPrompt: { text: composeAgentPrompt(agent), mode: plan.systemPromptMode },
      useWorktree: plan.useWorktree,
      timeoutMs: (params.timeoutSeconds ?? this.config.defaultTimeoutSeconds) * 1000,
      maxDiffChars: params.maxDiffChars ?? DEFAULT_MAX_DIFF_CHARS,
      message: params.input,
      logHeaderExtra: `agent=${agent.name} source=${agent.source}`,
    };
    return spec;
  }

  /** Shared launch path for both freeform tasks and named agents. */
  private async startManagedRun(spec: RunSpec, wait: boolean): Promise<TaskResult> {
    this.assertCapacity();

    const id = this.createId();
    const dir = taskDirFor(this.config.projectDir, id);
    await mkdir(dir, { recursive: true });
    const sessionDir = path.join(dir, "session");
    await mkdir(sessionDir, { recursive: true });

    const workspace = await setupWorkspace({
      projectDir: this.config.projectDir,
      taskDir: dir,
      mode: spec.mode,
      useWorktree: spec.useWorktree,
    });

    const logPath = path.join(dir, "task.log");
    const resultPath = path.join(dir, "result.json");
    const startedAt = new Date().toISOString();
    const record: ResultRecord = {
      taskId: id,
      status: "running",
      mode: spec.mode,
      summary: "",
      lastAssistantText: "",
      changedFiles: [],
      diffContent: "",
      resultPath,
      logPath,
      startedAt,
    };
    if (spec.agentName !== undefined) record.agentName = spec.agentName;
    if (workspace.worktreePath !== undefined) record.worktreePath = workspace.worktreePath;

    const logStream = createWriteStream(logPath, { flags: "a" });
    logStream.write(
      `# Pi run ${id}\n# mode=${spec.mode} useWorktree=${spec.useWorktree} tools=${spec.tools.join(",") || "(default)"} ` +
        `model=${spec.model || "(default)"} thinking=${spec.thinking} ${spec.logHeaderExtra ?? ""}\n` +
        `# cwd=${workspace.cwd}\n# started=${startedAt}\n\n`,
    );

    const message = typeof spec.message === "function" ? spec.message(workspace.cwd) : spec.message;
    const argsOpts: Parameters<typeof this.buildPiArgs>[0] = {
      tools: spec.tools,
      thinking: spec.thinking,
      sessionDir,
    };
    if (spec.provider) argsOpts.provider = spec.provider;
    if (spec.model) argsOpts.model = spec.model;
    if (spec.systemPrompt) argsOpts.systemPrompt = spec.systemPrompt;
    const args = this.buildPiArgs(argsOpts);

    const client = new PiRpcClient({
      piPath: this.config.piPath,
      cwd: workspace.cwd,
      args,
      env: process.env,
      onLog: (line) => {
        try {
          logStream.write(`${line}\n`);
        } catch {
          // ignore log write failures
        }
      },
    });

    const task: ManagedTask = {
      record,
      dir,
      client,
      workspace,
      logStream,
      running: true,
      startedAtMs: Date.now(),
      maxDiffChars: spec.maxDiffChars,
    };
    this.tasks.set(id, task);
    this.activeRuns += 1;
    void this.writeResult(task);

    try {
      client.start();
      await client.prompt(message);
    } catch (err) {
      await this.finalizeFailure(task, err);
      return buildTaskResult(record, spec.maxDiffChars);
    }

    task.completion = this.awaitCompletion(task, spec.timeoutMs);
    if (wait) {
      await task.completion;
    } else {
      task.completion.catch(() => undefined);
    }
    return buildTaskResult(record, spec.maxDiffChars);
  }

  private buildPiArgs(opts: {
    tools: string[];
    provider?: string;
    model?: string;
    thinking: string;
    sessionDir: string;
    systemPrompt?: { text: string; mode: "replace" | "append" };
  }): string[] {
    const args: string[] = ["--thinking", opts.thinking, "--session-dir", opts.sessionDir];
    // Omit --tools when empty so Pi falls back to its normal builtin toolset.
    if (opts.tools.length > 0) args.push("--tools", opts.tools.join(","));
    if (opts.provider) args.push("--provider", opts.provider);
    if (opts.model) args.push("--model", opts.model);
    if (opts.systemPrompt) {
      args.push(opts.systemPrompt.mode === "append" ? "--append-system-prompt" : "--system-prompt", opts.systemPrompt.text);
    }
    return args;
  }

  private async awaitCompletion(task: ManagedTask, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    try {
      for (;;) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          await this.finalizeTimeout(task, `Timed out after ${timeoutMs}ms`);
          return;
        }
        try {
          await task.client.waitForIdle(remaining);
        } catch (err) {
          if (TERMINAL.includes(task.record.status)) return;
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("waiting for Pi to finish")) {
            await this.finalizeTimeout(task, message);
          } else {
            await this.finalizeFailure(task, err);
          }
          return;
        }
        // agent_end seen — confirm the agent is truly idle (Pi may auto-retry and restart).
        let state: SessionState | undefined;
        try {
          state = await task.client.getState();
        } catch {
          break;
        }
        if (!state.isStreaming && (state.pendingMessageCount ?? 0) === 0) break;
      }
      await this.finalizeSuccess(task);
    } catch (err) {
      if (!TERMINAL.includes(task.record.status)) await this.finalizeFailure(task, err);
    }
  }

  private async finalizeSuccess(task: ManagedTask): Promise<void> {
    const { client, record } = task;
    try {
      record.lastAssistantText = (await client.getLastAssistantText()) ?? client.getPreview();
    } catch {
      record.lastAssistantText = client.getPreview();
    }
    record.summary = record.lastAssistantText;
    try {
      const state = await client.getState();
      if (state.sessionFile) record.sessionFile = state.sessionFile;
    } catch {
      // ignore
    }
    await this.captureDiff(task);
    record.status = "completed";
    record.endedAt = new Date().toISOString();
    this.releaseRun(task);
    await this.writeResult(task);
    // Keep the client alive for a follow-up window, then reap it to bound memory.
    this.scheduleReap(task);
  }

  /**
   * Schedule termination of a completed task's Pi process after `completedTtlSeconds`
   * of inactivity, so fire-and-forget batches don't accumulate idle ~150 MB processes.
   * A follow-up clears the timer (see followUp). 0 disables reaping.
   */
  private scheduleReap(task: ManagedTask): void {
    if (task.reapTimer) {
      clearTimeout(task.reapTimer);
      task.reapTimer = undefined;
    }
    const ttlMs = this.config.completedTtlSeconds * 1000;
    if (ttlMs <= 0) return;
    const timer = setTimeout(() => {
      // Only reap if still idle in a terminal state and the process is still alive.
      if (task.running || !task.client.isAlive()) return;
      task.logStream.write(`\n# reaped idle Pi process after ${this.config.completedTtlSeconds}s\n`);
      void task.client.stop().catch(() => undefined);
    }, ttlMs);
    if (typeof timer.unref === "function") timer.unref();
    task.reapTimer = timer;
  }

  private async finalizeTimeout(task: ManagedTask, message: string): Promise<void> {
    const { client, record } = task;
    record.status = "timeout";
    record.error = message;
    record.endedAt = new Date().toISOString();
    record.lastAssistantText = client.getPreview();
    record.summary = record.lastAssistantText;
    try {
      await client.abort();
    } catch {
      // ignore
    }
    await this.captureDiff(task);
    this.releaseRun(task);
    await client.stop();
    await this.writeResult(task);
  }

  private async finalizeFailure(task: ManagedTask, err: unknown): Promise<void> {
    const { client, record } = task;
    const base = err instanceof Error ? err.message : String(err);
    const stderr = client.getStderr().trim().slice(-500);
    record.status = "failed";
    record.error = stderr ? `${base}\nPi stderr: ${stderr}` : base;
    record.endedAt = new Date().toISOString();
    record.lastAssistantText = client.getPreview();
    record.summary = record.lastAssistantText;
    await this.captureDiff(task);
    this.releaseRun(task);
    await client.stop();
    await this.writeResult(task);
  }

  private async captureDiff(task: ManagedTask): Promise<void> {
    try {
      const collectOpts: { cwd: string; taskDir: string; worktreePath?: string } = {
        cwd: task.workspace.cwd,
        taskDir: task.dir,
      };
      // Only worktree runs capture a diff — never stage in the user's working tree.
      if (task.workspace.worktreePath) collectOpts.worktreePath = task.workspace.worktreePath;
      const { diffPath, changedFiles } = await collectResults(collectOpts);
      task.record.changedFiles = changedFiles;
      if (diffPath) {
        task.record.diffPath = diffPath;
        task.record.diffContent = await readFile(diffPath, "utf8").catch(() => "");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        task.logStream.write(`[diff capture failed] ${message}\n`);
      } catch {
        // ignore
      }
    }
  }

  private releaseRun(task: ManagedTask): void {
    if (task.running) {
      task.running = false;
      this.activeRuns = Math.max(0, this.activeRuns - 1);
    }
  }

  private async writeResult(task: ManagedTask): Promise<void> {
    try {
      const result = buildTaskResult(task.record, task.maxDiffChars);
      await writeFile(task.record.resultPath, JSON.stringify(result, null, 2), "utf8");
    } catch {
      // best-effort artifact
    }
  }
}

// ---------------------------------------------------------------------------
// Pi task prompt template
// ---------------------------------------------------------------------------

interface PromptParams {
  mode: TaskMode;
  projectDir: string;
  cwd: string;
  files: string[];
  task: string;
}

export function buildPiPrompt(params: PromptParams): string {
  const files = params.files.length > 0 ? params.files.join(", ") : "(none)";
  return `You are Pi, running as an external coding subagent under Claude Code orchestration.

You are working in an isolated task workspace unless told otherwise.

Task mode: ${params.mode}
Original project root: ${params.projectDir}
Current Pi working directory: ${params.cwd}
Files explicitly mentioned by Claude: ${files}

Your job:
${params.task}

Operating rules:
1. Stay within the requested task. Do not broaden scope.
2. Prefer inspecting before editing.
3. In review/plan/ask modes, do not modify files.
4. In patch/test modes, you may edit files in this workspace only.
5. Do not commit, push, create PRs, change remotes, or alter git config.
6. Do not access secrets, .env files, private keys, browser profiles, SSH keys, or credential stores.
7. Before running expensive or destructive commands, choose safer read-only commands.
8. Do not run production migrations, deployment commands, or network-destructive commands.
9. At the end, return a structured report:

REPORT:
- Summary:
- Files inspected:
- Files changed:
- Commands run:
- Tests/checks run:
- Result:
- Risks/unknowns:
- Recommended next step for Claude:

When you changed files, explain the diff at a high level. Do not paste huge diffs.`;
}

// ---------------------------------------------------------------------------
// Named-agent prompt composition
// ---------------------------------------------------------------------------

/** The agent's persona body plus a short, non-negotiable operating-constraints block. */
export function composeAgentPrompt(agent: AgentDef): string {
  return `${agent.body}

---
Operating constraints (you are running as a subagent under Claude Code orchestration):
- Stay strictly within the requested task; do not broaden scope.
- Do not access secrets, .env files, private keys, SSH keys, browser profiles, or credential stores.
- Do not commit, push, change git config/remotes, deploy, or run destructive or irreversible commands.
- Finish with a clear, self-contained summary of your findings or result for the caller.`;
}
