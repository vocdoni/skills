/**
 * Result truncation and formatting.
 *
 * `buildTaskResult` turns the manager's internal record into the public TaskResult,
 * applying diff truncation. `formatResultText` renders the compact, human-readable
 * summary Claude sees, with the full structured result appended as a JSON block.
 */
import type { ChangedFile, TaskMode, TaskResult, TaskStatus } from "./types";

export const DEFAULT_MAX_DIFF_CHARS = 12000;

export interface Truncated {
  text: string;
  truncated: boolean;
  originalLength: number;
}

/** Truncate `text` to at most `max` characters, appending a notice when cut. */
export function truncate(text: string, max: number): Truncated {
  const originalLength = text.length;
  if (max <= 0) {
    return { text: "", truncated: originalLength > 0, originalLength };
  }
  if (originalLength <= max) {
    return { text, truncated: false, originalLength };
  }
  const head = text.slice(0, max);
  return {
    text: `${head}\n… [truncated ${originalLength - max} of ${originalLength} chars]`,
    truncated: true,
    originalLength,
  };
}

/** Everything needed to assemble a public TaskResult. */
export interface ResultRecord {
  taskId: string;
  status: TaskStatus;
  mode: TaskMode;
  agentName?: string;
  summary: string;
  lastAssistantText: string;
  changedFiles: ChangedFile[];
  worktreePath?: string;
  diffPath?: string;
  diffContent: string;
  resultPath: string;
  logPath: string;
  sessionFile?: string;
  startedAt: string;
  endedAt?: string;
  error?: string;
}

export function buildTaskResult(record: ResultRecord, maxDiffChars = DEFAULT_MAX_DIFF_CHARS): TaskResult {
  const diff = truncate(record.diffContent, maxDiffChars);
  const result: TaskResult = {
    taskId: record.taskId,
    status: record.status,
    mode: record.mode,
    summary: record.summary,
    lastAssistantText: record.lastAssistantText,
    changedFiles: record.changedFiles,
    diffPreview: diff.text,
    diffTruncated: diff.truncated,
    resultPath: record.resultPath,
    logPath: record.logPath,
    startedAt: record.startedAt,
  };
  if (record.agentName !== undefined) result.agentName = record.agentName;
  if (record.worktreePath !== undefined) result.worktreePath = record.worktreePath;
  if (record.diffPath !== undefined) result.diffPath = record.diffPath;
  if (record.sessionFile !== undefined) result.sessionFile = record.sessionFile;
  if (record.endedAt !== undefined) result.endedAt = record.endedAt;
  if (record.error !== undefined) result.error = record.error;
  return result;
}

function firstLines(text: string, maxLines: number, maxChars: number): string {
  const collapsed = text.trim();
  if (collapsed === "") return "";
  const lines = collapsed.split("\n").slice(0, maxLines).join("\n");
  return truncate(lines, maxChars).text;
}

/** Compact, human-readable summary + machine-readable JSON block for Claude. */
export function formatResultText(result: TaskResult): string {
  const lines: string[] = [];
  const label = result.agentName ? `agent '${result.agentName}'` : `${result.mode} mode`;
  lines.push(`Pi task ${result.taskId} — ${result.status} (${label})`);

  const summary = firstLines(result.summary || result.lastAssistantText, 12, 1500);
  if (summary) {
    lines.push("");
    lines.push(summary);
  }

  if (result.error) {
    lines.push("");
    lines.push(`Error: ${result.error}`);
  }

  lines.push("");
  if (result.changedFiles.length > 0) {
    const names = result.changedFiles
      .map((f) => `${f.status} ${f.renamedFrom ? `${f.renamedFrom} -> ` : ""}${f.path}`)
      .slice(0, 30);
    lines.push(`Changed files (${result.changedFiles.length}):`);
    for (const n of names) lines.push(`  ${n}`);
    if (result.changedFiles.length > names.length) {
      lines.push(`  … and ${result.changedFiles.length - names.length} more`);
    }
  } else {
    lines.push("Changed files: none");
  }

  lines.push("");
  if (result.worktreePath) lines.push(`Worktree: ${result.worktreePath}`);
  if (result.diffPath) lines.push(`Diff:     ${result.diffPath}${result.diffTruncated ? " (preview truncated)" : ""}`);
  lines.push(`Result:   ${result.resultPath}`);
  lines.push(`Log:      ${result.logPath}`);
  if (result.sessionFile) lines.push(`Session:  ${result.sessionFile}`);

  // Full structured result for precise downstream use.
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(result, null, 2));
  lines.push("```");

  return lines.join("\n");
}
