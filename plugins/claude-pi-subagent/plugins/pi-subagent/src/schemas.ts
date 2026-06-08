/**
 * Zod raw shapes for MCP tool inputs, plus tool-allowlist resolution.
 *
 * The MCP SDK's `registerTool` expects an `inputSchema` that is a ZodRawShape
 * (a plain object whose values are Zod types), not a wrapped `z.object(...)`.
 */
import { z } from "zod";
import {
  BUILTIN_TOOLS,
  READONLY_MODES,
  READONLY_TOOLS,
  TASK_MODES,
  THINKING_LEVELS,
  WRITE_TOOLS,
  type BuiltinTool,
  type TaskMode,
} from "./types";

const modeField = z
  .enum(TASK_MODES)
  .describe("Task mode. read-only: ask, review, plan. write (worktree): patch, test.");

const thinkingField = z
  .enum(THINKING_LEVELS)
  .describe("Pi thinking/reasoning level. Overrides the plugin default.");

const toolsField = z
  .array(z.enum(BUILTIN_TOOLS))
  .describe(
    "Override the tool allowlist. Allowed: read, bash, edit, write, grep, find, ls. " +
      "Omit to use the safe default for the chosen mode.",
  );

const filesField = z
  .array(z.string())
  .describe("Files Claude wants Pi to focus on (project-relative). Passed to Pi as context.");

const providerField = z.string().describe("Pi provider override (e.g. anthropic, openai, google).");
const modelField = z.string().describe("Pi model override (pattern or 'provider/id[:thinking]').");
const useWorktreeField = z
  .boolean()
  .describe("Run inside an isolated detached git worktree. Defaults to the plugin setting.");
const timeoutField = z
  .number()
  .int()
  .positive()
  .describe("Wall-clock timeout in seconds for this run. Defaults to the plugin setting.");
const maxDiffField = z
  .number()
  .int()
  .positive()
  .describe("Maximum characters of diff to inline in the result preview.");

const taskField = z.string().min(1).describe("The bounded task for Pi to perform. Be specific and scoped.");

/** Shared shape for starting a task (pi_run_task / pi_start_task). */
export const startTaskShape = {
  task: taskField,
  mode: modeField.optional(),
  files: filesField.optional(),
  tools: toolsField.optional(),
  provider: providerField.optional(),
  model: modelField.optional(),
  thinking: thinkingField.optional(),
  useWorktree: useWorktreeField.optional(),
  timeoutSeconds: timeoutField.optional(),
  maxDiffChars: maxDiffField.optional(),
} as const;

export const getStatusShape = {
  taskId: z.string().min(1).describe("Task id returned by pi_run_task / pi_start_task."),
} as const;

export const getResultShape = {
  taskId: z.string().min(1).describe("Task id."),
  maxDiffChars: maxDiffField.optional(),
} as const;

export const steerShape = {
  taskId: z.string().min(1).describe("Task id of a running task."),
  message: z.string().min(1).describe("Steering instruction injected into the running task."),
} as const;

export const followUpShape = {
  taskId: z.string().min(1).describe("Task id."),
  message: z.string().min(1).describe("Follow-up instruction for the existing Pi session."),
  timeoutSeconds: timeoutField.optional(),
  maxDiffChars: maxDiffField.optional(),
} as const;

export const cancelShape = {
  taskId: z.string().min(1).describe("Task id to abort."),
} as const;

export const listTasksShape = {} as const;

export const cleanupShape = {
  taskId: z
    .string()
    .min(1)
    .optional()
    .describe("Task id to clean up. Omit to clean up all finished (non-running) tasks."),
  removeWorktree: z
    .boolean()
    .optional()
    .describe("Remove the git worktree and run directory. Default true."),
} as const;

export const applyResultShape = {
  taskId: z.string().min(1).describe("Completed task whose diff.patch should be applied to the project."),
} as const;

export const runAgentShape = {
  agent: z.string().min(1).describe("Name of a defined pi-agent (see pi_list_agents)."),
  input: z
    .string()
    .min(1)
    .describe("The caller's input for the agent — e.g. a name, term, topic, or task (e.g. 'Vocdoni')."),
  model: modelField.optional().describe("Override the agent's model (default: the agent's declared model)."),
  thinking: thinkingField.optional(),
  useWorktree: useWorktreeField.optional(),
  timeoutSeconds: timeoutField.optional(),
  maxDiffChars: maxDiffField.optional(),
  background: z
    .boolean()
    .optional()
    .describe("Run without blocking; returns immediately with a running task to poll via pi_get_status."),
} as const;

export const listAgentsShape = {} as const;

// ---------------------------------------------------------------------------
// Tool allowlist resolution
// ---------------------------------------------------------------------------

/** Split a tool list into recognized built-ins and unrecognized names. */
export function validateTools(tools: readonly string[]): { valid: BuiltinTool[]; invalid: string[] } {
  const allowed = new Set<string>(BUILTIN_TOOLS);
  const valid: BuiltinTool[] = [];
  const invalid: string[] = [];
  for (const raw of tools) {
    const name = raw.trim().toLowerCase();
    if (allowed.has(name)) {
      if (!valid.includes(name as BuiltinTool)) valid.push(name as BuiltinTool);
    } else {
      invalid.push(raw);
    }
  }
  return { valid, invalid };
}

/** Default tool allowlist for a mode. */
export function defaultToolsForMode(mode: TaskMode): BuiltinTool[] {
  return READONLY_MODES.includes(mode) ? [...READONLY_TOOLS] : [...WRITE_TOOLS];
}

/**
 * Resolve the effective tool list: a validated caller override, or the mode default.
 * Throws on any unrecognized tool name.
 */
export function resolveTools(mode: TaskMode, override?: readonly string[]): BuiltinTool[] {
  if (!override || override.length === 0) return defaultToolsForMode(mode);
  const { valid, invalid } = validateTools(override);
  if (invalid.length > 0) {
    throw new Error(
      `Invalid tool(s): ${invalid.join(", ")}. Allowed built-ins: ${BUILTIN_TOOLS.join(", ")}.`,
    );
  }
  return valid;
}
