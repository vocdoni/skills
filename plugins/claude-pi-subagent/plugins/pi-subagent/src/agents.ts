/**
 * Named pi-agent definitions.
 *
 * An agent is a Markdown file with YAML-ish frontmatter and a system-prompt body —
 * the same shape used by the `pi-subagents` Pi extension, so definitions are portable:
 *
 *   ---
 *   name: web-scout
 *   description: Researches a name/term and returns a summary
 *   model: mimo/mimo-v2.5-pro
 *   tools: read, web_search_exa, web_fetch_exa, mcp
 *   thinking: medium
 *   systemPromptMode: replace
 *   ---
 *   You are a web-scout subagent. …
 *
 * We deliberately use a tiny purpose-built frontmatter parser (the fields are simple
 * scalars and comma lists) rather than pulling in a YAML dependency.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface AgentDef {
  name: string;
  description?: string;
  /** Pi model, e.g. "mimo/mimo-v2.5-pro". */
  model?: string;
  /** Tool allowlist passed to Pi (builtins, MCP tool names, the `mcp` proxy, extension paths). */
  tools?: string[];
  thinking?: string;
  /** replace = clean persona (default); append = added onto Pi's base prompt. */
  systemPromptMode: "replace" | "append";
  /** The system-prompt body. */
  body: string;
  /** Absolute path of the source file. */
  source: string;
}

/** Allowed characters in a Pi tool name (builtins, MCP tools, mcp:server/tool, extension paths). */
const SAFE_TOOL = /^[A-Za-z0-9_.:/\\@+-]+$/;

const KNOWN_KEYS = new Set([
  "name",
  "description",
  "model",
  "tools",
  "thinking",
  "systemPromptMode",
]);

function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/** Parse a frontmatter block into a flat key→string map (last key wins). */
export function parseFrontmatter(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = stripQuotes(line.slice(idx + 1).trim());
    out[key] = value;
  }
  return out;
}

/** Split a comma-separated tool list, trimming and dropping empties. */
export function splitTools(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");
}

/** Partition tool names into accepted and rejected (unsafe characters). */
export function sanitizeTools(tools: readonly string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const tool of tools) {
    if (SAFE_TOOL.test(tool) && !tool.includes("\0")) {
      if (!valid.includes(tool)) valid.push(tool);
    } else {
      invalid.push(tool);
    }
  }
  return { valid, invalid };
}

/** Parse one agent file. Returns null if it has no frontmatter or no `name`. */
export function parseAgent(content: string, source: string): AgentDef | null {
  const match = content.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const fm = parseFrontmatter(match[1] ?? "");
  const body = (match[2] ?? "").trim();
  const name = fm.name?.trim();
  if (!name) return null;

  const def: AgentDef = {
    name,
    body,
    source,
    systemPromptMode: fm.systemPromptMode?.trim().toLowerCase() === "append" ? "append" : "replace",
  };
  if (fm.description) def.description = fm.description;
  if (fm.model) def.model = fm.model.trim();
  if (fm.thinking) def.thinking = fm.thinking.trim();
  if (fm.tools !== undefined) def.tools = splitTools(fm.tools);
  return def;
}

async function listMarkdown(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out; // directory absent — skip
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listMarkdown(full)));
    } else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.endsWith(".chain.md")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Discover agents across directories. Directories are processed in order, so entries
 * later in `dirs` override earlier same-named agents (project beats user).
 */
export async function discoverAgents(dirs: readonly string[]): Promise<Map<string, AgentDef>> {
  const agents = new Map<string, AgentDef>();
  for (const dir of dirs) {
    const files = await listMarkdown(dir);
    files.sort();
    for (const file of files) {
      let content: string;
      try {
        content = await readFile(file, "utf8");
      } catch {
        continue;
      }
      const def = parseAgent(content, file);
      if (def) agents.set(def.name, def);
    }
  }
  return agents;
}

/** Tools that imply the agent can mutate files (so a worktree should be used by default). */
const WRITE_TOOLS = new Set(["edit", "write", "bash"]);

export function agentCanWrite(def: AgentDef): boolean {
  // No explicit allowlist → Pi grants its full default toolset (edit/write/bash included).
  if (def.tools === undefined) return true;
  return def.tools.some((t) => WRITE_TOOLS.has(t.toLowerCase()));
}

export interface AgentRunDefaults {
  defaultModel: string;
  defaultThinking: string;
  useWorktrees: boolean;
}

export interface AgentRunOverrides {
  model?: string;
  thinking?: string;
  useWorktree?: boolean;
}

export interface AgentRunPlan {
  /** Synthetic mode used for workspace setup + result labeling. */
  mode: "review" | "patch";
  model: string;
  tools: string[];
  thinking: string;
  systemPromptMode: "replace" | "append";
  useWorktree: boolean;
}

/**
 * Resolve how an agent should be launched: effective model (override → agent → default),
 * sanitized tools, thinking level, and whether to isolate in a worktree (write-capable
 * agents default on; read-only default off). Pure and deterministic. Throws on a missing
 * model or unsafe tool names.
 */
export function planAgentRun(agent: AgentDef, overrides: AgentRunOverrides, defaults: AgentRunDefaults): AgentRunPlan {
  const model = overrides.model ?? agent.model ?? defaults.defaultModel;
  if (!model) {
    throw new Error(`Agent '${agent.name}' has no model and no default is configured. Add 'model:' to ${agent.source}.`);
  }
  const { valid: tools, invalid } = sanitizeTools(agent.tools ?? []);
  if (invalid.length > 0) {
    throw new Error(`Agent '${agent.name}' declares unsafe tool name(s): ${invalid.join(", ")}.`);
  }
  const canWrite = agentCanWrite(agent);
  return {
    mode: canWrite ? "patch" : "review",
    model,
    tools,
    thinking: overrides.thinking ?? agent.thinking ?? defaults.defaultThinking,
    systemPromptMode: agent.systemPromptMode,
    useWorktree: overrides.useWorktree ?? (canWrite ? defaults.useWorktrees : false),
  };
}
