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

A **skill** is one directory whose name must match `name:` in its `SKILL.md` frontmatter. A **plugin** bundles related skills (one per language/topic; named `vocdoni-<topic>` so the npx short form `--plugin <topic>` resolves). The **marketplace manifest** lists every plugin with `source` pointing at its directory — or, for remote plugins, at a git URL.

Adding a plugin requires **two** edits that must stay in sync: create `plugins/<name>/.claude-plugin/plugin.json` AND register the same entry in `.claude-plugin/marketplace.json`, matching `name`, `version`, and `license`. `bin/install.js` discovers local plugins only via `plugins/<name>/.claude-plugin/plugin.json`; Claude Code's marketplace reads `marketplace.json`. A plugin missing from one is invisible to that consumer. Also add it to the right README section — `README.md` is split by audience ("Skills for integrators" vs "Skills for the Vocdoni team"), so placement is a deliberate call.

The two `description` fields deliberately differ and are **not** kept in sync: `marketplace.json` carries a short listing blurb, `plugin.json` a fuller one. Don't "fix" the divergence. Neither field affects skill auto-loading — only `SKILL.md` frontmatter does that.

A plugin's skills are resolved two ways (`skillsFromManifest` in `bin/install.js`): if `plugin.json` has a `skills: [{name, path}]` array those paths win; otherwise every directory under `skills/` containing a `SKILL.md` is picked up. The local Vocdoni plugins use the implicit scan; remote plugins are expected to declare the array.

### Remote plugins

A marketplace entry whose `source` is a **git source object** is not in this repo at all:

```json
"source": { "source": "github", "repo": "vocdoni/integrator-sdk" }
"source": { "source": "url", "url": "https://gitlab.com/team/plugin.git", "ref": "v2.0.0" }
```

`bin/install.js` shallow-clones it into `~/.cache/vocdoni-skills/<name>/` (fetch + ff-only merge if already cached) and then treats it exactly like a local plugin. `vocdoni-integrator-sdk` is the live example — it lives at `github.com/vocdoni/integrator-sdk`. Fetch failures warn and skip rather than abort; `--offline` uses the cache and never touches the network. A remote repo must carry its own `.claude-plugin/plugin.json`.

**Use the object form, never a bare URL string.** `resolveRemoteSource` in `bin/install.js` still accepts `"https://…"`/`"git@…"` strings for backwards compatibility, but Claude Code's marketplace parser does not — it fails the install with *"This plugin uses a source type your Claude Code version does not support"*, which reads like a version problem and is not one. Supported object types: `github` (`repo`, optional `ref`/`sha`), `url`/`git` (`url`, optional `ref`/`sha`), and `git-subdir` (`url` + `path`) for a plugin inside a monorepo.

Consequence: `marketplace.json` has **5** entries but `bin/install.js list` shows **4** plugins — three local skill plugins plus the remote one, tagged `[remote: …]`. `pi-subagent` is the missing fifth: it lives at `plugins/claude-pi-subagent/` with no `plugin.json` at that level (its real plugin is one directory deeper), so the npx CLI cannot see it. This is intentional: `pi-subagent` is Claude Code-only (it needs Pi and an MCP server) and is reachable only through the root `marketplace.json` entry, never via `npx @vocdoni/skills`.

## The installer (`bin/install.js`)

Zero-dependency Node CLI (`vocdoni-skills` bin), the published surface of the package. It walks `plugins/*/`, reads each `plugin.json` and the skills under `skills/`, and copies or symlinks skill directories into a destination (default `~/.claude/skills`). Skill descriptions are parsed straight out of `SKILL.md` frontmatter. `--plugin go` maps to plugin `vocdoni-go`; a bare skill name is resolved across all plugins and errors if ambiguous.

`npm run lint` is aliased to `node bin/install.js list` — that listing is the lint: it surfaces broken plugins (bad JSON, missing `SKILL.md`) and shows how each truncated description reads.

## Common commands

```sh
# Validate the marketplace — every plugin + skill + truncated description
node bin/install.js list

# Same, without hitting the network for remote plugins
node bin/install.js list --offline

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
