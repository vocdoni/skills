# pi-agent-tools — Claude Code plugin marketplace

A small Claude Code **plugin marketplace** for delegating coding work to the
[Pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) coding agent.

## Plugins

- **[pi-subagent](./plugins/pi-subagent)** — Delegate to **named Pi subagents** (`.md` persona +
  model + tools, including MCP tools) and bounded coding tasks from Claude Code, via `pi --mode rpc`.
  Define an agent once (e.g. a `web-scout` that researches a term with an MCP search server and
  returns a summary), then say *"use pi-agent web-scout to research Vocdoni"*. The plugin bundles a
  local stdio MCP server that discovers your agents, launches Pi configured as the chosen agent,
  isolates code edits in a detached git worktree, and returns compact summaries plus diff paths —
  never applying changes automatically.

  **→ Full documentation:
  [plugins/pi-subagent/README.md](./plugins/pi-subagent/README.md)** (setup, creating and
  configuring subagents, real examples, tool reference).

## Install

From Claude Code:

```text
/plugin marketplace add ./plugins/claude-pi-subagent
/plugin install pi-subagent@pi-agent-tools
/reload-plugins
/mcp
```

Point `/plugin marketplace add` at the directory containing `.claude-plugin/marketplace.json` (this
directory); use an absolute path if a relative one does not resolve. The plugin is also published in
the parent **vocdoni** marketplace, so `pi-subagent@vocdoni` works as well.

## Layout

```
.claude-plugin/marketplace.json   # marketplace manifest (name: pi-agent-tools)
plugins/pi-subagent/              # the plugin — see its README
```

## License

MIT
