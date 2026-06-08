/**
 * Path-safety helpers. Every run artifact must live under <project>/.claude/pi-runs,
 * and any path we resolve (worktree cwd, caller-mentioned files) must stay inside the
 * project directory. We reject NUL bytes and refuse to follow paths into the project's
 * parent or into system directories.
 */
import { realpathSync } from "node:fs";
import path from "node:path";

/** Absolute prefixes we never allow a resolved path to fall under. */
const SYSTEM_PREFIXES = ["/etc", "/usr", "/bin", "/sbin", "/lib", "/proc", "/sys", "/dev", "/root", "/boot"];

export function assertNoNul(p: string): void {
  if (p.includes("\0")) throw new Error("Path contains a NUL byte");
}

function safeRealpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p; // path may not exist yet; fall back to the lexical form
  }
}

/** Resolve and canonicalize the project directory from a raw value. */
export function resolveProjectDir(raw: string | undefined): string {
  const base = raw && raw.trim() ? raw.trim() : process.cwd();
  assertNoNul(base);
  return safeRealpath(path.resolve(base));
}

/** True when `child` is `parent` itself or nested beneath it. */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function assertNotSystemPath(resolved: string): void {
  for (const prefix of SYSTEM_PREFIXES) {
    if (resolved === prefix || resolved.startsWith(`${prefix}/`)) {
      throw new Error(`Refusing to use a system path: ${resolved}`);
    }
  }
}

/**
 * Validate that a candidate directory (e.g. the worktree cwd) canonicalizes to a
 * location inside the project. Returns the realpath. Throws on escape / NUL / system path.
 */
export function assertInsideProject(projectDir: string, candidate: string): string {
  assertNoNul(candidate);
  const project = safeRealpath(path.resolve(projectDir));
  const resolved = safeRealpath(path.resolve(project, candidate));
  assertNotSystemPath(resolved);
  if (!isInside(project, resolved)) {
    throw new Error(`Path escapes the project directory: ${candidate}`);
  }
  return resolved;
}

/**
 * Lexically validate a caller-supplied file path stays within the project. Does not
 * require the file to exist (it is only passed to Pi as context). Returns the absolute path.
 */
export function assertFileInProject(projectDir: string, file: string): string {
  assertNoNul(file);
  const project = path.resolve(projectDir);
  const resolved = path.resolve(project, file);
  assertNotSystemPath(resolved);
  if (!isInside(project, resolved)) {
    throw new Error(`File path escapes the project directory: ${file}`);
  }
  return resolved;
}

/** <project>/.claude/pi-runs */
export function runsDir(projectDir: string): string {
  return path.join(projectDir, ".claude", "pi-runs");
}

/** <project>/.claude/pi-runs/<taskId> */
export function taskDir(projectDir: string, taskId: string): string {
  return path.join(runsDir(projectDir), taskId);
}
