import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { collectResults, setupWorkspace, teardownWorktree } from "../src/worktree";

function git(args: string[], cwd: string): void {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function tmpProject(prefix: string): string {
  return realpathSync(mkdtempSync(path.join(os.tmpdir(), prefix)));
}

describe("worktree integration (real git)", () => {
  let project: string;

  beforeAll(() => {
    project = tmpProject("pi-wt-");
    git(["init", "-q", "-b", "main"], project);
    git(["config", "user.email", "test@example.com"], project);
    git(["config", "user.name", "Test"], project);
    git(["config", "commit.gpgsign", "false"], project);
    writeFileSync(path.join(project, "a.txt"), "hello\n");
    git(["add", "-A"], project);
    git(["commit", "-q", "-m", "init"], project);
  });

  it("creates a detached worktree, captures a complete diff, and leaves the main tree untouched", async () => {
    const taskDir = path.join(project, ".claude", "pi-runs", "t1");
    await mkdir(taskDir, { recursive: true });

    const ws = await setupWorkspace({ projectDir: project, taskDir, mode: "patch", useWorktree: true });
    expect(ws.isGit).toBe(true);
    expect(ws.worktreePath).toBe(path.join(taskDir, "worktree"));
    expect(ws.cwd).toBe(realpathSync(ws.worktreePath!));

    // Simulate Pi editing inside the isolated worktree.
    writeFileSync(path.join(ws.cwd, "a.txt"), "hello world\n"); // modify tracked
    writeFileSync(path.join(ws.cwd, "b.txt"), "new file\n"); // add untracked

    const { diffPath, changedFiles } = await collectResults({ cwd: ws.cwd, taskDir, worktreePath: ws.worktreePath });
    expect(diffPath && existsSync(diffPath)).toBeTruthy();

    const patch = readFileSync(diffPath!, "utf8");
    expect(patch).toContain("a/a.txt");
    expect(patch).toContain("b/b.txt"); // untracked file captured via `git add -A`
    expect(patch).toContain("hello world");

    const paths = changedFiles.map((f) => f.path).sort();
    expect(paths).toEqual(["a.txt", "b.txt"]);

    // The user's working tree is never modified.
    expect(readFileSync(path.join(project, "a.txt"), "utf8")).toBe("hello\n");

    await teardownWorktree({ projectDir: project, worktreePath: ws.worktreePath });
    expect(existsSync(ws.cwd)).toBe(false);
  });

  it("in-place runs (no worktree) never stage in the user's repo", async () => {
    // Simulate a read-only / useWorktree=false run: cwd = the project itself, no worktree.
    const taskDir = path.join(project, ".claude", "pi-runs", "inplace");
    await mkdir(taskDir, { recursive: true });
    // Stray artifacts + an unrelated edit that must NOT get staged.
    writeFileSync(path.join(project, "a.txt"), "edited in place\n");
    writeFileSync(path.join(taskDir, "artifact.log"), "run artifact\n");

    const out = await collectResults({ cwd: project, taskDir }); // no worktreePath
    expect(out.changedFiles).toEqual([]);
    expect(out.diffPath).toBeUndefined();

    // The user's index must be untouched — nothing staged.
    const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: project }).toString().trim();
    expect(staged).toBe("");

    git(["checkout", "--", "a.txt"], project); // restore for other tests
  });

  it("refuses patch mode in a non-git project", async () => {
    const nonGit = tmpProject("pi-nogit-");
    const taskDir = path.join(nonGit, ".claude", "pi-runs", "t");
    await mkdir(taskDir, { recursive: true });
    await expect(
      setupWorkspace({ projectDir: nonGit, taskDir, mode: "patch", useWorktree: true }),
    ).rejects.toThrow(/not a git repository/);
  });

  it("allows read-only mode in a non-git project, running in place", async () => {
    const nonGit = tmpProject("pi-nogit2-");
    const ws = await setupWorkspace({
      projectDir: nonGit,
      taskDir: path.join(nonGit, "t"),
      mode: "review",
      useWorktree: true,
    });
    expect(ws.isGit).toBe(false);
    expect(ws.worktreePath).toBeUndefined();
    expect(ws.cwd).toBe(nonGit);
  });
});
