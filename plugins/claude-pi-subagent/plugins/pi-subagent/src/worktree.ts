/**
 * Workspace isolation for a task.
 *
 * Default: a detached git worktree at <project>/.claude/pi-runs/<id>/worktree, created
 * with `git worktree add --detach <wt> HEAD`. Pi only ever edits inside it; the user's
 * working tree is never touched, and changes are never applied automatically.
 *
 * Non-git projects: patch/test modes are refused with a clear error (copying a temp
 * workspace is a future enhancement). Read-only modes may run in place.
 */
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { READONLY_MODES, type ChangedFile, type TaskMode } from "./types";
import { assertInsideProject } from "./paths";
import { collectDiff, isGitRepo, realGitRunner, repoRoot, worktreeAdd, worktreeRemove, type GitRunner } from "./git";

export interface Workspace {
  /** Directory Pi runs in. */
  cwd: string;
  /** Set when an isolated worktree was created. */
  worktreePath?: string;
  /** Whether the workspace is backed by git (diffs available). */
  isGit: boolean;
}

export interface SetupOptions {
  projectDir: string;
  taskDir: string;
  mode: TaskMode;
  useWorktree: boolean;
  run?: GitRunner;
}

export async function setupWorkspace(options: SetupOptions): Promise<Workspace> {
  const run = options.run ?? realGitRunner;
  const git = await isGitRepo(options.projectDir, run);
  const readOnly = READONLY_MODES.includes(options.mode);

  if (options.useWorktree && git) {
    const root = await repoRoot(options.projectDir, run);
    const worktreePath = path.join(options.taskDir, "worktree");
    await mkdir(options.taskDir, { recursive: true });
    await worktreeAdd(root, worktreePath, run);
    const cwd = assertInsideProject(options.projectDir, worktreePath);
    return { cwd, worktreePath, isGit: true };
  }

  if (options.useWorktree && !git) {
    if (!readOnly) {
      throw new Error(
        `Cannot isolate '${options.mode}' mode: ${options.projectDir} is not a git repository, so a worktree ` +
          `cannot be created. Initialize git, choose a read-only mode (ask/review/plan), or pass useWorktree=false ` +
          `to run in place (no isolation — not recommended for patch/test).`,
      );
    }
    return { cwd: options.projectDir, isGit: false };
  }

  // useWorktree === false: run directly in the project directory.
  return { cwd: options.projectDir, isGit: git };
}

export interface CollectOptions {
  cwd: string;
  taskDir: string;
  /** Set only for isolated worktree runs. Diffs are captured ONLY here. */
  worktreePath?: string;
  run?: GitRunner;
}

/**
 * Write diff.patch and return the changed-file list — but ONLY for isolated worktree
 * runs. Diff capture stages files (`git add -A`), which would mutate the user's index if
 * run in their working tree, so in-place runs (read-only agents, useWorktree=false) never
 * capture a diff.
 */
export async function collectResults(options: CollectOptions): Promise<{ diffPath?: string; changedFiles: ChangedFile[] }> {
  if (!options.worktreePath) return { changedFiles: [] };
  const run = options.run ?? realGitRunner;
  const { patch, changed } = await collectDiff(options.cwd, run);
  const diffPath = path.join(options.taskDir, "diff.patch");
  await writeFile(diffPath, patch, "utf8");
  return { diffPath, changedFiles: changed };
}

export interface TeardownOptions {
  projectDir: string;
  worktreePath?: string;
  run?: GitRunner;
}

export async function teardownWorktree(options: TeardownOptions): Promise<void> {
  if (!options.worktreePath) return;
  const run = options.run ?? realGitRunner;
  try {
    const root = await repoRoot(options.projectDir, run);
    await worktreeRemove(root, options.worktreePath, run);
  } catch {
    // best-effort: a manual `git worktree prune` will clean up stragglers
  }
}
