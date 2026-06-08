/**
 * Server configuration, resolved from environment variables.
 *
 * The plugin's `.mcp.json` maps userConfig values into PI_SUBAGENT_* env vars via
 * `${user_config.*}` interpolation. We also fall back to the raw CLAUDE_* env vars
 * that Claude Code injects (CLAUDE_PLUGIN_ROOT / CLAUDE_PLUGIN_DATA / CLAUDE_PROJECT_DIR
 * and CLAUDE_PLUGIN_OPTION_*), and ignore unexpanded `${...}` placeholders, so the
 * server still works when launched manually or if interpolation is unavailable.
 */
import os from "node:os";
import path from "node:path";
import { THINKING_LEVELS, type ThinkingLevel } from "./types";
import { resolveProjectDir } from "./paths";

export interface Config {
  piPath: string;
  defaultProvider: string;
  defaultModel: string;
  defaultThinking: ThinkingLevel;
  maxParallel: number;
  defaultTimeoutSeconds: number;
  useWorktrees: boolean;
  allowApply: boolean;
  projectDir: string;
  dataDir: string;
  pluginRoot: string;
  /** Directories searched for named pi-agent `.md` definitions (low → high priority). */
  agentsDirs: string[];
}

/**
 * Resolve the directories searched for agent definitions. Later entries win on name
 * collisions: user (~/.pi/agents) < project (.pi/agents, pi-agents) < explicit override.
 */
function resolveAgentDirs(projectDir: string, configured: string | undefined): string[] {
  const dirs = [
    path.join(os.homedir(), ".pi", "agents"),
    path.join(projectDir, ".pi", "agents"),
    path.join(projectDir, "pi-agents"),
  ];
  if (configured) dirs.push(path.resolve(configured));
  return [...new Set(dirs)];
}

type Env = Record<string, string | undefined>;

/** A value that is undefined, empty, or a literal unexpanded `${...}` placeholder is "unset". */
function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed.startsWith("${") && trimmed.endsWith("}")) return undefined;
  return trimmed;
}

function firstStr(env: Env, names: string[], fallback: string): string {
  for (const name of names) {
    const v = clean(env[name]);
    if (v !== undefined) return v;
  }
  return fallback;
}

function firstRaw(env: Env, names: string[]): string | undefined {
  for (const name of names) {
    const v = clean(env[name]);
    if (v !== undefined) return v;
  }
  return undefined;
}

function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.toLowerCase();
  if (["true", "1", "yes", "on"].includes(v)) return true;
  if (["false", "0", "no", "off"].includes(v)) return false;
  return fallback;
}

function asInt(value: string | undefined, fallback: number, min: number): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

function asThinking(value: string | undefined, fallback: ThinkingLevel): ThinkingLevel {
  if (value && (THINKING_LEVELS as readonly string[]).includes(value)) return value as ThinkingLevel;
  return fallback;
}

export function loadConfig(env: Env = process.env): Config {
  const projectDir = resolveProjectDir(firstStr(env, ["PI_SUBAGENT_PROJECT_DIR", "CLAUDE_PROJECT_DIR"], process.cwd()));
  const pluginRoot = firstStr(env, ["PI_SUBAGENT_PLUGIN_ROOT", "CLAUDE_PLUGIN_ROOT"], process.cwd());
  const dataDir = firstStr(
    env,
    ["PI_SUBAGENT_DATA_DIR", "CLAUDE_PLUGIN_DATA"],
    path.join(os.tmpdir(), "pi-subagent-data"),
  );

  return {
    piPath: firstStr(env, ["PI_SUBAGENT_PI_PATH", "CLAUDE_PLUGIN_OPTION_PI_PATH"], "pi"),
    defaultProvider: firstStr(env, ["PI_SUBAGENT_DEFAULT_PROVIDER", "CLAUDE_PLUGIN_OPTION_DEFAULT_PROVIDER"], ""),
    defaultModel: firstStr(env, ["PI_SUBAGENT_DEFAULT_MODEL", "CLAUDE_PLUGIN_OPTION_DEFAULT_MODEL"], ""),
    defaultThinking: asThinking(
      firstRaw(env, ["PI_SUBAGENT_DEFAULT_THINKING", "CLAUDE_PLUGIN_OPTION_DEFAULT_THINKING"]),
      "medium",
    ),
    maxParallel: asInt(firstRaw(env, ["PI_SUBAGENT_MAX_PARALLEL", "CLAUDE_PLUGIN_OPTION_MAX_PARALLEL_TASKS"]), 2, 1),
    defaultTimeoutSeconds: asInt(
      firstRaw(env, ["PI_SUBAGENT_DEFAULT_TIMEOUT_SECONDS", "CLAUDE_PLUGIN_OPTION_DEFAULT_TIMEOUT_SECONDS"]),
      900,
      1,
    ),
    useWorktrees: asBool(
      firstRaw(env, ["PI_SUBAGENT_USE_WORKTREES", "CLAUDE_PLUGIN_OPTION_USE_WORKTREES_BY_DEFAULT"]),
      true,
    ),
    allowApply: asBool(firstRaw(env, ["PI_SUBAGENT_ALLOW_APPLY", "CLAUDE_PLUGIN_OPTION_ALLOW_APPLY_TOOL"]), false),
    projectDir,
    dataDir,
    pluginRoot,
    agentsDirs: resolveAgentDirs(projectDir, firstRaw(env, ["PI_SUBAGENT_AGENTS_DIR", "CLAUDE_PLUGIN_OPTION_AGENTS_DIR"])),
  };
}
