/**
 * Shared domain types and constants for the pi-subagent MCP server.
 *
 * The Pi RPC wire types here are a deliberately small, permissive subset of the
 * real protocol exposed by `pi --mode rpc` (package @earendil-works/pi-coding-agent,
 * a.k.a. @mariozechner/pi-coding-agent). We narrow only the fields we depend on and
 * tolerate unknown event/response shapes so we stay forward-compatible across Pi
 * versions.
 */

export const TASK_MODES = ["ask", "review", "plan", "patch", "test"] as const;
export type TaskMode = (typeof TASK_MODES)[number];

/** Modes that must never modify files. */
export const READONLY_MODES: readonly TaskMode[] = ["ask", "review", "plan"];

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

/** Pi built-in tool names that callers may select from. */
export const BUILTIN_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls"] as const;
export type BuiltinTool = (typeof BUILTIN_TOOLS)[number];

/** Default tool allowlist for read-only modes (ask/review/plan). */
export const READONLY_TOOLS: readonly BuiltinTool[] = ["read", "grep", "find", "ls"];
/** Default tool allowlist for write modes (patch/test). */
export const WRITE_TOOLS: readonly BuiltinTool[] = ["read", "grep", "find", "ls", "edit", "write", "bash"];

export const TASK_STATUSES = ["pending", "running", "completed", "failed", "cancelled", "timeout"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// ---------------------------------------------------------------------------
// Pi RPC wire types (subset)
// ---------------------------------------------------------------------------

export interface RpcResponseSuccess {
  id?: string;
  type: "response";
  command: string;
  success: true;
  data?: unknown;
}

export interface RpcResponseError {
  id?: string;
  type: "response";
  command: string;
  success: false;
  error: string;
}

export type RpcResponse = RpcResponseSuccess | RpcResponseError;

/**
 * Agent events are an open set (e.g. agent_start, message_update, tool_execution_*,
 * agent_end, and runtime-only events like auto_retry_start). We keep this permissive
 * on purpose.
 */
export interface PiEvent {
  type: string;
  [key: string]: unknown;
}

/** Subset of Pi's RpcSessionState that we read. */
export interface SessionState {
  isStreaming: boolean;
  isCompacting?: boolean;
  sessionFile?: string;
  sessionId?: string;
  messageCount?: number;
  pendingMessageCount?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ChangedFile {
  /** Two-character git porcelain status, trimmed (e.g. "M", "A", "D", "R"). */
  status: string;
  path: string;
  renamedFrom?: string;
}

export interface ToolActivity {
  toolCallId: string;
  toolName: string;
  status: "running" | "done" | "error";
  argsPreview?: string;
}

/** Public, serialized result for a Pi task. */
export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  mode: TaskMode;
  /** Set when the task was launched from a named pi-agent definition. */
  agentName?: string;
  summary: string;
  lastAssistantText: string;
  changedFiles: ChangedFile[];
  worktreePath?: string;
  diffPath?: string;
  diffPreview: string;
  diffTruncated: boolean;
  resultPath: string;
  logPath: string;
  sessionFile?: string;
  startedAt: string;
  endedAt?: string;
  error?: string;
}
