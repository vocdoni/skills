import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  agentCanWrite,
  discoverAgents,
  parseAgent,
  parseFrontmatter,
  planAgentRun,
  sanitizeTools,
  splitTools,
  type AgentDef,
} from "../src/agents";
import { composeAgentPrompt } from "../src/pi-task-manager";

const NUL = String.fromCharCode(0);
const DEFAULTS = { defaultModel: "mimo/mimo-v2.5", defaultThinking: "medium", useWorktrees: true };

function agent(partial: Partial<AgentDef> & { name: string }): AgentDef {
  return { source: "f", body: "", systemPromptMode: "replace", ...partial };
}

describe("parseFrontmatter", () => {
  it("parses key:value, ignores comments/blank lines, strips quotes", () => {
    const fm = parseFrontmatter(['name: web-scout', '# a comment', '', 'model: "mimo/mimo-v2.5-pro"', "thinking: 'high'"].join("\n"));
    expect(fm).toEqual({ name: "web-scout", model: "mimo/mimo-v2.5-pro", thinking: "high" });
  });
});

describe("splitTools", () => {
  it("splits, trims, and drops empties", () => {
    expect(splitTools("read,  web_search_exa ,, mcp")).toEqual(["read", "web_search_exa", "mcp"]);
  });
});

describe("sanitizeTools", () => {
  it("accepts builtins, MCP tool names, mcp: selectors, and extension paths", () => {
    const { valid, invalid } = sanitizeTools(["read", "web_search_exa", "mcp", "mcp:exa/web_search_exa", "./ext.ts", "anthropic/claude-4"]);
    expect(valid).toEqual(["read", "web_search_exa", "mcp", "mcp:exa/web_search_exa", "./ext.ts", "anthropic/claude-4"]);
    expect(invalid).toEqual([]);
  });

  it("rejects unsafe names and de-duplicates", () => {
    const { valid, invalid } = sanitizeTools(["read", "read", "bad name", "rm;rf", `x${NUL}`]);
    expect(valid).toEqual(["read"]);
    expect(invalid).toEqual(["bad name", "rm;rf", `x${NUL}`]);
  });
});

describe("parseAgent", () => {
  const file = "/agents/web-scout.md";

  it("parses frontmatter + body into an AgentDef", () => {
    const md = [
      "---",
      "name: web-scout",
      "description: Researches a term",
      "model: mimo/mimo-v2.5-pro",
      "tools: read, web_search_exa, mcp",
      "thinking: medium",
      "systemPromptMode: replace",
      "---",
      "You are Web Scout.",
      "",
      "Do the research.",
    ].join("\n");
    const def = parseAgent(md, file);
    expect(def).toMatchObject({
      name: "web-scout",
      description: "Researches a term",
      model: "mimo/mimo-v2.5-pro",
      tools: ["read", "web_search_exa", "mcp"],
      thinking: "medium",
      systemPromptMode: "replace",
      source: file,
    });
    expect(def?.body).toBe("You are Web Scout.\n\nDo the research.");
  });

  it("defaults systemPromptMode to replace and recognizes append", () => {
    expect(parseAgent("---\nname: a\n---\nbody", file)?.systemPromptMode).toBe("replace");
    expect(parseAgent("---\nname: a\nsystemPromptMode: append\n---\nbody", file)?.systemPromptMode).toBe("append");
  });

  it("returns null without frontmatter or without a name", () => {
    expect(parseAgent("no frontmatter here", file)).toBeNull();
    expect(parseAgent("---\ndescription: x\n---\nbody", file)).toBeNull();
  });
});

describe("agentCanWrite", () => {
  it("treats an omitted tool list as write-capable (full default toolset)", () => {
    expect(agentCanWrite({ name: "a", body: "", source: "f", systemPromptMode: "replace" })).toBe(true);
  });
  it("is read-only when the explicit allowlist has no write tools", () => {
    const def = { name: "a", body: "", source: "f", systemPromptMode: "replace" as const, tools: ["read", "web_search_exa", "mcp"] };
    expect(agentCanWrite(def)).toBe(false);
  });
  it("is write-capable when edit/write/bash is present", () => {
    const def = { name: "a", body: "", source: "f", systemPromptMode: "replace" as const, tools: ["read", "bash"] };
    expect(agentCanWrite(def)).toBe(true);
  });
});

describe("discoverAgents", () => {
  it("reads .md files, skips .chain.md, and lets later dirs override by name", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "pi-agents-"));
    const userDir = path.join(root, "user");
    const projDir = path.join(root, "project");
    mkdirSync(userDir);
    mkdirSync(projDir);
    writeFileSync(path.join(userDir, "web-scout.md"), "---\nname: web-scout\nmodel: mimo/mimo-v2.5\n---\nuser version");
    writeFileSync(path.join(userDir, "reviewer.md"), "---\nname: reviewer\n---\nreview");
    writeFileSync(path.join(userDir, "flow.chain.md"), "---\nname: flow\n---\nignored");
    writeFileSync(path.join(projDir, "web-scout.md"), "---\nname: web-scout\nmodel: mimo/mimo-v2.5-pro\n---\nproject version");

    const agents = await discoverAgents([userDir, projDir]);
    expect([...agents.keys()].sort()).toEqual(["reviewer", "web-scout"]);
    // project dir (later) overrides user
    expect(agents.get("web-scout")?.model).toBe("mimo/mimo-v2.5-pro");
    expect(agents.get("web-scout")?.body).toBe("project version");
    // .chain.md ignored
    expect(agents.has("flow")).toBe(false);
  });

  it("ignores missing directories", async () => {
    const agents = await discoverAgents(["/no/such/dir/123"]);
    expect(agents.size).toBe(0);
  });
});

describe("planAgentRun", () => {
  it("read-only agent → review mode, no worktree, model/thinking from the agent", () => {
    const plan = planAgentRun(
      agent({ name: "web-scout", model: "mimo/mimo-v2.5-pro", thinking: "high", tools: ["read", "web_search_exa", "mcp"] }),
      {},
      DEFAULTS,
    );
    expect(plan).toEqual({
      mode: "review",
      model: "mimo/mimo-v2.5-pro",
      tools: ["read", "web_search_exa", "mcp"],
      thinking: "high",
      systemPromptMode: "replace",
      useWorktree: false,
    });
  });

  it("write-capable agent (bash/edit/write) → patch mode, worktree on", () => {
    const plan = planAgentRun(agent({ name: "code-smith", model: "mimo/mimo-v2.5", tools: ["read", "edit", "write", "bash"] }), {}, DEFAULTS);
    expect(plan.mode).toBe("patch");
    expect(plan.useWorktree).toBe(true);
  });

  it("agent with no tools → write-capable (full default toolset), worktree on", () => {
    const plan = planAgentRun(agent({ name: "researcher", model: "mimo/mimo-v2.5-pro" }), {}, DEFAULTS);
    expect(plan.mode).toBe("patch");
    expect(plan.useWorktree).toBe(true);
    expect(plan.tools).toEqual([]);
  });

  it("overrides win over agent and defaults", () => {
    const plan = planAgentRun(
      agent({ name: "x", model: "mimo/mimo-v2.5", tools: ["read"] }),
      { model: "mimo/mimo-v2.5-pro", thinking: "xhigh", useWorktree: true },
      DEFAULTS,
    );
    expect(plan.model).toBe("mimo/mimo-v2.5-pro");
    expect(plan.thinking).toBe("xhigh");
    expect(plan.useWorktree).toBe(true);
  });

  it("falls back to the default model and throws when none is available", () => {
    expect(planAgentRun(agent({ name: "x", tools: ["read"] }), {}, DEFAULTS).model).toBe("mimo/mimo-v2.5");
    expect(() => planAgentRun(agent({ name: "x", tools: ["read"] }), {}, { ...DEFAULTS, defaultModel: "" })).toThrow(/no model/);
  });

  it("rejects unsafe tool names", () => {
    expect(() => planAgentRun(agent({ name: "x", model: "m", tools: ["read", "bad name"] }), {}, DEFAULTS)).toThrow(/unsafe tool/);
  });
});

describe("composeAgentPrompt", () => {
  it("includes the persona body and operating constraints", () => {
    const text = composeAgentPrompt({ name: "web-scout", body: "You are Web Scout.", source: "f", systemPromptMode: "replace" });
    expect(text).toContain("You are Web Scout.");
    expect(text).toContain("Operating constraints");
    expect(text).toContain("do not broaden scope");
  });
});
