# Vocdoni Skills

Curated [Agent Skills][skills-docs] from [Vocdoni][vocdoni], packaged as a **Claude Code plugin marketplace** and also installable via `npx` for any client that reads a skills directory (Cursor, Cline, Zed, …) or via the **Claude API**.

```sh
# Claude Code — add the marketplace, then install what you want
claude plugin marketplace add vocdoni/skills
claude plugin install vocdoni-go@vocdoni
claude plugin install vocdoni-sdk@vocdoni

# Or grab everything in one shot
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
│   └── vocdoni-sdk/
│       └── …
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
[vocdoni]: https://vocdoni.io
