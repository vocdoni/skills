# Example Pi subagents

Real-world **Pi-agent personas** you can copy as a starting point for your own. Each `.md` is a
self-contained agent definition: YAML frontmatter (`name`, `description`, `model`, `tools`,
`thinking`, `systemPromptMode`) followed by the system prompt that drives the agent.

These are **examples**, not functional agents of this plugin (the plugin's own agent is
[`../pi-delegator.md`](../pi-delegator.md)). To use one, copy it into your Pi agents directory
(`~/.pi/agents/`), then make it discoverable to the `pi-subagent` MCP server.

| File | What it does | Tools |
|---|---|---|
| [`web-scout.md`](./web-scout.md) | Web research & profiling of an org/person → a sourced answer or lead card | Jina + Tavily (MCP), Obscura headless browser (via `bash`) |
| [`mail-finder.md`](./mail-finder.md) | Finds **and verifies** a decision-maker's business email by web research + pattern generation, confirmed with DeBounce | Jina + Tavily + a DeBounce `verify_email` MCP tool |
| [`browser-scout.md`](./browser-scout.md) | Headless-browser page fetcher for JS-heavy / blocked pages (Obscura fallback) | `bash` (Obscura) |

## Before you run them

- **No secrets here.** These files contain no API keys. The MCP tools they reference
  (`jina_search_web`, `tavily_tavily_search`, `debounce_verify_email`, …) are wired — **with their
  credentials** — in your own Pi MCP adapter config (`~/.pi/agent/mcp.json`), never in the agent
  files. Set those up for your environment.
- **The `model:` field is host-specific.** These examples pin models served on the author's local
  vLLM host (e.g. `z7/gpt-oss`, `mimo/mimo-v2.5-pro`). Change it to a model you have configured in
  `~/.pi/agent/models.json` (or any provider Pi knows), or drop the line to use Pi's default.
- The tool names must match what your MCP adapter exposes; rename them to fit your servers.

See the [plugin README](../../README.md) for how the MCP server discovers agents and how to invoke
them from Claude Code.
