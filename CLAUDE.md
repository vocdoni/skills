# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`@vocdoni/skills` — a **Claude Code plugin marketplace** of curated Agent Skills, also installable via an `npx` CLI for any client that reads a skills directory (Cursor, Cline, Zed) or via the Claude API. It ships no runtime application; the deliverable is the skill content itself plus the installer.

## Three-layer structure

```
marketplace (.claude-plugin/marketplace.json)
└── plugin (plugins/<name>/.claude-plugin/plugin.json)
    └── skill (plugins/<name>/skills/<skill>/SKILL.md)
```

A **skill** is one directory whose name must match `name:` in its `SKILL.md` frontmatter. A **plugin** bundles related skills (one per language/topic; named `vocdoni-<topic>` so the npx short form `--plugin <topic>` resolves). The **marketplace manifest** lists every plugin with `source` pointing at its directory.

Adding a plugin requires **two** edits that must stay in sync: create `plugins/<name>/.claude-plugin/plugin.json` AND register the same entry in `.claude-plugin/marketplace.json` (matching `name`, `version`, `description`). `bin/install.js` discovers plugins only via `plugins/<name>/.claude-plugin/plugin.json`; Claude Code's marketplace reads `marketplace.json`. A plugin missing from one is invisible to that consumer.

Consequence: `bin/install.js list` shows the Markdown skill plugins only (currently `vocdoni-go`, `vocdoni-sdk`, `davinci-sdk`, `vocdoni-integrator-sdk`), not `pi-subagent`. `pi-subagent` lives at `plugins/claude-pi-subagent/` with no `plugin.json` at that level — its real plugin is one directory deeper — so the npx CLI cannot see it. This is intentional: `pi-subagent` is Claude Code-only (it needs Pi and an MCP server) and is reachable only through the root `marketplace.json` entry, never via `npx @vocdoni/skills`.

## The installer (`bin/install.js`)

Zero-dependency Node CLI (`vocdoni-skills` bin), the published surface of the package. It walks `plugins/*/`, reads each `plugin.json` and the skills under `skills/`, and copies or symlinks skill directories into a destination (default `~/.claude/skills`). Skill descriptions are parsed straight out of `SKILL.md` frontmatter. `--plugin go` maps to plugin `vocdoni-go`; a bare skill name is resolved across all plugins and errors if ambiguous.

`npm run lint` is aliased to `node bin/install.js list` — that listing is the lint: it surfaces broken plugins (bad JSON, missing `SKILL.md`) and shows how each truncated description reads.

## Common commands

```sh
# Validate the marketplace — every plugin + skill + truncated description
node bin/install.js list

# Dry-run a full install
node bin/install.js install --dest /tmp/skills-test --dry-run

# Author a skill with live updates into real config
node bin/install.js install <skill> --symlink --force
```

The `pi-subagent` plugin is a real TypeScript package (see below); the other plugins are pure Markdown and have no build step.

## The `pi-subagent` plugin (nested marketplace)

`plugins/claude-pi-subagent/` is itself a marketplace (`.claude-plugin/marketplace.json`, owner "pi-agent-tools") wrapping a single plugin at `plugins/claude-pi-subagent/plugins/pi-subagent/`. That double nesting is why its `source` in the root marketplace is the deep path. It is the only plugin with code: an MCP server (`@modelcontextprotocol/sdk` + `zod`, ESM, Node ≥20) that launches Pi (`pi --mode rpc`), isolates edits in detached git worktrees, and returns diffs without applying them.

Build/test from `plugins/claude-pi-subagent/plugins/pi-subagent/`:

```sh
npm run build       # tsup → dist/server.mjs (committed; .mcp.json points at it)
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npx vitest run test/path-safety.test.ts   # single test file
```

`dist/` is gitignored at the repo root but the built `dist/server.mjs` is committed inside the plugin because `.mcp.json` references it at runtime — rebuild and commit it when changing `src/`.

## Conventions (from CONTRIBUTING.md)

- A skill is evergreen guidance for a recurring class of tasks, not docs or a tutorial. The `description` (third person, ≤1024 chars, concrete triggers + technologies named) is the **only** signal the model uses to auto-load it — invest there.
- `SKILL.md` body: lead with the rule, then why, then how. Show code over prose. Cross-link related skills with `[[skill-name]]` (link liberally, even to skills not yet written). No emojis, no marketing language, no AI-tell phrasing.
- A `SKILL.md` may use `!` directive lines that run a shell command at load time and substitute the output (see `go-modern`) — the result is injected, so the skill should not redo that work.
- Optional per-skill subdirs: `references/` (loaded on demand), `examples/`, `scripts/`, `recipes/`.
- License is AGPL-3.0-or-later for the marketplace and Vocdoni plugins; `pi-subagent` is MIT — keep each plugin's declared license consistent across its `plugin.json` and the marketplace entry.

## Releasing

Bump `version` in lockstep across the three places it appears: `package.json` (CLI), the changed plugin's `plugin.json`, and that plugin's entry in `.claude-plugin/marketplace.json`. Then tag (`vX.Y.Z`) and `npm publish --access public`.
