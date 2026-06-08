/**
 * Git helpers used for worktree isolation and diff capture.
 *
 * All commands go through an injectable `GitRunner` so the diff/status parsing can be
 * unit-tested with mocked output. `parsePorcelain` is a pure function.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ChangedFile } from "./types";

const execFileAsync = promisify(execFile);

export interface GitOutput {
  stdout: string;
  stderr: string;
}

export type GitRunner = (args: readonly string[], cwd: string) => Promise<GitOutput>;

export const realGitRunner: GitRunner = async (args, cwd) => {
  const { stdout, stderr } = await execFileAsync("git", [...args], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { stdout: String(stdout), stderr: String(stderr) };
};

export async function isGitRepo(dir: string, run: GitRunner = realGitRunner): Promise<boolean> {
  try {
    const { stdout } = await run(["rev-parse", "--is-inside-work-tree"], dir);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function repoRoot(dir: string, run: GitRunner = realGitRunner): Promise<string> {
  const { stdout } = await run(["rev-parse", "--show-toplevel"], dir);
  return stdout.trim();
}

export async function worktreeAdd(root: string, worktreePath: string, run: GitRunner = realGitRunner): Promise<void> {
  await run(["worktree", "add", "--detach", worktreePath, "HEAD"], root);
}

export async function worktreeRemove(root: string, worktreePath: string, run: GitRunner = realGitRunner): Promise<void> {
  await run(["worktree", "remove", "--force", worktreePath], root);
}

/** Decode a git porcelain path, unquoting C-style quoted names when present. */
function decodePath(raw: string): string {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Parse `git status --porcelain` (v1) output into a list of changed files.
 * Handles renames (`R  old -> new`) and quoted paths.
 */
export function parsePorcelain(output: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  for (const line of output.split("\n")) {
    if (line.trim() === "") continue;
    const xy = line.slice(0, 2);
    let rest = line.slice(3);
    let renamedFrom: string | undefined;
    const arrow = rest.indexOf(" -> ");
    if (arrow >= 0) {
      renamedFrom = decodePath(rest.slice(0, arrow));
      rest = rest.slice(arrow + 4);
    }
    const file: ChangedFile = { status: xy.trim() || xy, path: decodePath(rest) };
    if (renamedFrom !== undefined) file.renamedFrom = renamedFrom;
    files.push(file);
  }
  return files;
}

/**
 * Capture a complete patch and the changed-file list for a working tree.
 *
 * We stage everything first (`git add -A`) so that newly created/untracked files are
 * included, then emit a single binary patch (`git diff --binary --cached`) and the
 * porcelain status. Staging is harmless: each task runs in its own detached worktree
 * with its own index.
 */
export async function collectDiff(
  cwd: string,
  run: GitRunner = realGitRunner,
): Promise<{ patch: string; changed: ChangedFile[] }> {
  await run(["add", "-A"], cwd);
  const status = await run(["status", "--porcelain"], cwd);
  const diff = await run(["diff", "--binary", "--cached"], cwd);
  return { patch: diff.stdout, changed: parsePorcelain(status.stdout) };
}

/** Apply a patch file into a working tree (used by the optional pi_apply_result tool). */
export async function applyPatch(projectDir: string, patchFile: string, run: GitRunner = realGitRunner): Promise<void> {
  await run(["apply", "--3way", "--whitespace=nowarn", patchFile], projectDir);
}
