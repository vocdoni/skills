import { describe, expect, it } from "vitest";
import { collectDiff, parsePorcelain, type GitRunner } from "../src/git";
import { buildTaskResult, formatResultText, truncate, type ResultRecord } from "../src/result-format";

describe("truncate", () => {
  it("returns text unchanged when within the limit", () => {
    expect(truncate("abc", 10)).toEqual({ text: "abc", truncated: false, originalLength: 3 });
  });

  it("does not truncate at the exact boundary", () => {
    expect(truncate("abc", 3)).toEqual({ text: "abc", truncated: false, originalLength: 3 });
  });

  it("truncates and annotates when over the limit", () => {
    const result = truncate("abcdefghij", 4);
    expect(result.truncated).toBe(true);
    expect(result.originalLength).toBe(10);
    expect(result.text.startsWith("abcd")).toBe(true);
    expect(result.text).toContain("[truncated 6 of 10 chars]");
  });

  it("handles a zero limit", () => {
    expect(truncate("abc", 0)).toEqual({ text: "", truncated: true, originalLength: 3 });
    expect(truncate("", 0)).toEqual({ text: "", truncated: false, originalLength: 0 });
  });
});

function baseRecord(overrides: Partial<ResultRecord> = {}): ResultRecord {
  return {
    taskId: "pi-test",
    status: "completed",
    mode: "patch",
    summary: "Did the thing.",
    lastAssistantText: "Did the thing.",
    changedFiles: [{ status: "M", path: "src/a.ts" }],
    diffContent: "X".repeat(50),
    resultPath: "/runs/pi-test/result.json",
    logPath: "/runs/pi-test/task.log",
    startedAt: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildTaskResult", () => {
  it("maps record fields and truncates the diff preview", () => {
    const result = buildTaskResult(baseRecord({ worktreePath: "/runs/pi-test/worktree", diffPath: "/runs/pi-test/diff.patch" }), 20);
    expect(result.taskId).toBe("pi-test");
    expect(result.status).toBe("completed");
    expect(result.mode).toBe("patch");
    expect(result.changedFiles).toHaveLength(1);
    expect(result.worktreePath).toBe("/runs/pi-test/worktree");
    expect(result.diffPath).toBe("/runs/pi-test/diff.patch");
    expect(result.diffTruncated).toBe(true);
    expect(result.diffPreview).toContain("[truncated");
  });

  it("omits optional fields that are absent", () => {
    const result = buildTaskResult(baseRecord(), 1000);
    expect(result.diffTruncated).toBe(false);
    expect(result.worktreePath).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(result.sessionFile).toBeUndefined();
  });
});

describe("formatResultText", () => {
  it("includes a header, changed files, and a JSON block", () => {
    const text = formatResultText(buildTaskResult(baseRecord({ error: "boom", status: "failed" }), 1000));
    expect(text).toContain("Pi task pi-test — failed");
    expect(text).toContain("Changed files (1):");
    expect(text).toContain("M src/a.ts");
    expect(text).toContain("Error: boom");
    expect(text).toContain("```json");
  });
});

describe("parsePorcelain", () => {
  it("parses modified, added, deleted, untracked, renamed, and quoted paths", () => {
    const output = [
      " M src/a.ts",
      "A  src/b.ts",
      " D src/c.ts",
      "?? new/untracked.ts",
      "R  old/name.ts -> new/name.ts",
      'A  "src/with space.ts"',
      "",
    ].join("\n");

    const files = parsePorcelain(output);
    expect(files).toContainEqual({ status: "M", path: "src/a.ts" });
    expect(files).toContainEqual({ status: "A", path: "src/b.ts" });
    expect(files).toContainEqual({ status: "D", path: "src/c.ts" });
    expect(files).toContainEqual({ status: "??", path: "new/untracked.ts" });
    expect(files).toContainEqual({ status: "R", path: "new/name.ts", renamedFrom: "old/name.ts" });
    expect(files).toContainEqual({ status: "A", path: "src/with space.ts" });
    expect(files).toHaveLength(6);
  });
});

describe("collectDiff (mocked git)", () => {
  it("stages, reads status, emits a binary patch, and parses changed files", async () => {
    const calls: string[][] = [];
    const run: GitRunner = async (args) => {
      calls.push([...args]);
      const cmd = args[0];
      if (cmd === "status") return { stdout: " M src/a.ts\nA  src/b.ts\n", stderr: "" };
      if (cmd === "diff") return { stdout: "diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@\n-old\n+new\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };

    const { patch, changed } = await collectDiff("/work", run);

    expect(calls[0]).toEqual(["add", "-A"]);
    expect(calls.some((c) => c[0] === "status" && c[1] === "--porcelain")).toBe(true);
    expect(calls.some((c) => c[0] === "diff" && c.includes("--binary"))).toBe(true);
    expect(patch).toContain("diff --git a/src/a.ts");
    expect(changed).toEqual([
      { status: "M", path: "src/a.ts" },
      { status: "A", path: "src/b.ts" },
    ]);
  });
});
