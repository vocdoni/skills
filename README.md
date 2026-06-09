# Vocdoni Skills

Curated [Agent Skills][skills-docs] from [Vocdoni][vocdoni], packaged as a **Claude Code plugin marketplace** and also installable via `npx` for any client that reads a skills directory (Cursor, Cline, Zed, …) or via the **Claude API**.

```sh
# Claude Code — add the marketplace, then install what you want
claude plugin marketplace add vocdoni/skills
claude plugin install vocdoni-go@vocdoni
claude plugin install vocdoni-sdk@vocdoni
claude plugin install davinci-sdk@vocdoni
claude plugin install pi-subagent@vocdoni   # MCP server + agents — needs Pi (see its README)

# Or grab everything in one shot (skill plugins only; pi-subagent is Claude Code-only)
npx @vocdoni/skills install
```

---

## Plugins

### 🐹 `vocdoni-go` — Go engineering

| Skill                | What it covers                                                            |
| -------------------- | ------------------------------------------------------------------------- |
| `go-best-practices`  | Rob Pike's *Go Proverbs* — idiomatic & architectural defaults.            |
| `go-code-quality`    | Production checklist: domain types, error contracts, context, goroutines. |
| `go-modern`          | Version-aware modern Go syntax. Reads `go.mod` to pick the right target.  |

### 🗳️ `vocdoni-sdk` — Vocdoni voting SDK

| Skill                      | What it covers                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `vocdoni-sdk`              | Exhaustive [`@vocdoni/sdk`][sdk] reference — client, accounts, census, all election variants, anonymous (ZK), CSP, Census3 — plus runnable recipes. |
| `vocdoni-ballot-protocol`  | The on-chain data model the SDK serialises into: ballot encoding, results matrix, parameter semantics. |

### 🔐 `davinci-sdk` — Vocdoni Davinci (zk voting) SDK

| Skill         | What it covers                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `davinci-sdk` | The [`@vocdoni/davinci-sdk`][davinci-sdk] facade — create a process, cast encrypted (ElGamal + zk-SNARK) votes, every census type (Merkle/dynamic/CSP/on-chain), ballot-mode configuration, lifecycle, and results — plus protocol grounding and runnable recipes. |

### 🤖 `pi-subagent` — delegate to Pi subagents

Delegate work to **named [Pi][pi] subagents** — reusable personas, each with its own model and tools (including MCP tools) — and to bounded one-off coding tasks. Unlike the skill plugins above, this one bundles a local **MCP server** that launches Pi (`pi --mode rpc`), isolates code edits in a detached **git worktree**, and hands back a summary plus a diff to review. Changes are never applied automatically.

From Claude: *"use pi-agent **web-scout** to research Vocdoni"* → a sourced summary produced by Pi.

| Provides | What it is |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `pi_run_agent`, `pi_list_agents`                   | Run / list named `.md` subagents (persona + model + tools, incl. MCP).   |
| `pi_run_task`, `pi_get_status`, `pi_get_result`, … | Bounded coding tasks with worktree isolation and reviewable diffs.       |

Requires [Pi][pi] (and, for MCP-backed agents, the [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter)). **See the [`pi-subagent` README](./plugins/claude-pi-subagent/plugins/pi-subagent/README.md)** for setup, creating and configuring subagents, real examples, and the full tool reference.

More plugins (`vocdoni-typescript`, `vocdoni-solidity`, …) will land under `plugins/` over time.

---

## Install

### Claude Code

```sh
# Add this repo as a marketplace
claude plugin marketplace add vocdoni/skills

# Install all current plugins
claude plugin install vocdoni-go@vocdoni
claude plugin install vocdoni-sdk@vocdoni
claude plugin install davinci-sdk@vocdoni
claude plugin install pi-subagent@vocdoni   # see plugins/claude-pi-subagent/plugins/pi-subagent/README.md
```

Iterating locally? Point the marketplace at a checkout instead:

```sh
claude plugin marketplace add /path/to/skills
```

### npx (any client that reads a skills directory)

Installs into `~/.claude/skills/` by default (where Claude Code looks at user scope).

```sh
# All plugins at once
npx @vocdoni/skills install

# A whole plugin (short form: 'go' → 'vocdoni-go', 'sdk' → 'vocdoni-sdk')
npx @vocdoni/skills install --plugin go
npx @vocdoni/skills install --plugin sdk
npx @vocdoni/skills install --plugin davinci-sdk   # full name (no vocdoni- prefix)

# A single skill, looked up across plugins
npx @vocdoni/skills install go-modern

# Project-local, as a symlink for live updates while authoring
npx @vocdoni/skills install --plugin sdk --dest ./.claude/skills --symlink
```

Other commands: `list`, `uninstall`, plus `--force`, `--dry-run`. Full help:

```sh
npx @vocdoni/skills --help
```

### Manual / Claude API

Skills are plain directories at `plugins/<plugin>/skills/<skill>/`.

- **Manual**: copy or symlink into `~/.claude/skills/` (user) or `<project>/.claude/skills/` (project), or whatever your client reads.
- **Claude API**: upload `SKILL.md` and its supporting files via the [Skills API][skills-api].

---

## Layout

```
.
├── .claude-plugin/marketplace.json     # Marketplace manifest
├── plugins/
│   ├── vocdoni-go/
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/<skill>/SKILL.md
│   ├── vocdoni-sdk/
│   │   └── …
│   ├── davinci-sdk/
│   │   └── …
│   └── claude-pi-subagent/             # nested marketplace (pi-agent-tools)
│       └── plugins/pi-subagent/        # MCP server plugin + agents — see its README
├── bin/install.js                      # npx CLI (zero deps, Node ≥ 18)
├── package.json                        # Published as @vocdoni/skills
├── README.md
├── CONTRIBUTING.md                     # Authoring guide
└── LICENSE                             # AGPL-3.0-or-later
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the skill format, naming rules, and the steps to add a new skill or plugin.

## License

[AGPL-3.0-or-later](./LICENSE).

[skills-docs]: https://docs.claude.com/en/docs/claude-code/skills
[skills-api]: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview
[sdk]: https://github.com/vocdoni/vocdoni-sdk
[davinci-sdk]: https://github.com/vocdoni/davinci-sdk
[vocdoni]: https://vocdoni.io
[pi]: https://www.npmjs.com/package/@earendil-works/pi-coding-agent
