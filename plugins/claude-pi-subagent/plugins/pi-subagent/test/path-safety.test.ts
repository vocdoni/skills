import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { assertFileInProject, assertInsideProject, assertNoNul, isInside, resolveProjectDir, runsDir, taskDir } from "../src/paths";
import { defaultToolsForMode, resolveTools, validateTools } from "../src/schemas";

const NUL = String.fromCharCode(0);

describe("path safety", () => {
  let project: string;

  beforeAll(() => {
    project = realpathSync(mkdtempSync(path.join(os.tmpdir(), "pi-paths-")));
    mkdirSync(path.join(project, "src"));
  });

  describe("assertInsideProject", () => {
    it("accepts the project root and nested paths", () => {
      expect(assertInsideProject(project, ".")).toBe(project);
      expect(assertInsideProject(project, "src")).toBe(path.join(project, "src"));
    });

    it("rejects parent-escaping relative paths", () => {
      expect(() => assertInsideProject(project, "../escape")).toThrow(/escapes the project/);
      expect(() => assertInsideProject(project, "../../etc")).toThrow(/escapes the project|system path/);
    });

    it("rejects absolute system paths", () => {
      expect(() => assertInsideProject(project, "/etc/passwd")).toThrow(/system path|escapes the project/);
    });

    it("rejects NUL bytes", () => {
      expect(() => assertInsideProject(project, `a${NUL}b`)).toThrow(/NUL/);
    });
  });

  describe("assertFileInProject", () => {
    it("accepts in-project files (existence not required)", () => {
      expect(assertFileInProject(project, "src/new-file.ts")).toBe(path.join(project, "src", "new-file.ts"));
    });

    it("rejects escapes, system paths, and NUL", () => {
      expect(() => assertFileInProject(project, "../../secrets.txt")).toThrow(/escapes the project/);
      expect(() => assertFileInProject(project, "/etc/shadow")).toThrow(/system path|escapes the project/);
      expect(() => assertFileInProject(project, `x${NUL}y`)).toThrow(/NUL/);
    });
  });

  describe("helpers", () => {
    it("isInside distinguishes nested from outside", () => {
      expect(isInside(project, path.join(project, "a", "b"))).toBe(true);
      expect(isInside(project, project)).toBe(true);
      expect(isInside(project, path.resolve(project, ".."))).toBe(false);
    });

    it("assertNoNul throws only on NUL", () => {
      expect(() => assertNoNul("clean/path")).not.toThrow();
      expect(() => assertNoNul(`bad${NUL}`)).toThrow(/NUL/);
    });

    it("runsDir and taskDir live under <project>/.claude/pi-runs", () => {
      expect(runsDir(project)).toBe(path.join(project, ".claude", "pi-runs"));
      expect(taskDir(project, "pi-123")).toBe(path.join(project, ".claude", "pi-runs", "pi-123"));
    });

    it("resolveProjectDir canonicalizes and rejects NUL", () => {
      expect(resolveProjectDir(project)).toBe(project);
      expect(() => resolveProjectDir(`bad${NUL}`)).toThrow(/NUL/);
    });
  });
});

describe("tool allowlist validation", () => {
  it("splits recognized built-ins from unknown names", () => {
    expect(validateTools(["read", "bash"])).toEqual({ valid: ["read", "bash"], invalid: [] });
    expect(validateTools(["read", "frobnicate", "teleport"])).toEqual({
      valid: ["read"],
      invalid: ["frobnicate", "teleport"],
    });
  });

  it("is case-insensitive, trims, and de-duplicates", () => {
    expect(validateTools(["READ", " Grep ", "read"])).toEqual({ valid: ["read", "grep"], invalid: [] });
  });

  it("defaults differ by mode", () => {
    expect(defaultToolsForMode("ask")).toEqual(["read", "grep", "find", "ls"]);
    expect(defaultToolsForMode("review")).toEqual(["read", "grep", "find", "ls"]);
    expect(defaultToolsForMode("patch")).toEqual(["read", "grep", "find", "ls", "edit", "write", "bash"]);
    expect(defaultToolsForMode("test")).toContain("write");
  });

  it("resolveTools uses defaults, honors valid overrides, and rejects invalid ones", () => {
    expect(resolveTools("review")).toEqual(["read", "grep", "find", "ls"]);
    expect(resolveTools("patch", ["read", "edit"])).toEqual(["read", "edit"]);
    expect(() => resolveTools("ask", ["read", "bogus"])).toThrow(/Invalid tool/);
  });
});
