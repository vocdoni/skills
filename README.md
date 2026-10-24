# Vocdoni Skills

Curated [Agent Skills][skills-docs] from [Vocdoni][vocdoni], packaged as a **Claude Code plugin marketplace** and also installable via `npx` for any client that reads a skills directory (Cursor, Cline, Zed, …) or via the **Claude API**.

```sh
# Claude Code — add the marketplace, then install what you want
claude plugin marketplace add vocdoni/skills

# Building on Vocdoni? These are for you:
claude plugin install vocdoni-sdk@vocdoni
claude plugin install davinci-sdk@vocdoni
claude plugin install vocdoni-integrator-sdk@vocdoni

# Internal tooling we use at Vocdoni:
claude plugin install vocdoni-go@vocdoni
claude plugin install vocdoni-stripe@vocdoni
claude plugin install vocdoni-internal-oauth@vocdoni
claude plugin install vocdoni-ui-style@vocdoni
claude plugin install agentic-dev@vocdoni
claude plugin install pi-subagent@vocdoni   # MCP server + agents — needs Pi (see its README)

# Or grab everything in one shot (skill plugins only; pi-subagent is Claude Code-only)
npx @vocdoni/skills install
```

---

## Skills for integrators

SDK references for anyone building voting on Vocdoni — clients, partners, and third-party developers.

### 🗳️ `vocdoni-sdk` — Vocdoni voting SDK

| Skill                      | What it covers                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `vocdoni-sdk`              | Exhaustive [`@vocdoni/sdk`][sdk] reference — client, accounts, census, all election variants, anonymous (ZK), CSP, Census3 — plus runnable recipes. |
| `vocdoni-ballot-protocol`  | The on-chain data model the SDK serialises into: ballot encoding, results matrix, parameter semantics. |

### 🔐 `davinci-sdk` — Vocdoni Davinci (zk voting) SDK

| Skill         | What it covers                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `davinci-sdk` | The [`@vocdoni/davinci-sdk`][davinci-sdk] facade — create a process, cast encrypted (ElGamal + zk-SNARK) votes, every census type (Merkle/dynamic/CSP/on-chain), ballot-mode configuration, lifecycle, and results — plus protocol grounding and runnable recipes. |

### 🧩 `vocdoni-integrator-sdk` — Vocdoni Integrator SDK

| Skill            | What it covers                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `vocdoni-integrator-sdk` | The [Integrator SDK][integrator-sdk] packages — `@vocdoni/api-client`, `@vocdoni/api-voting`, `@vocdoni/react-providers`, `@vocdoni/react-components`: CSP auth flow, vote relay, ballot building, and React integration, with runnable recipes. |

This is a **remote plugin**: the skill lives in the [vocdoni-integrator-sdk repo][integrator-sdk] and is cloned (or pulled) on demand by the npx CLI — pass `--offline` to skip fetching and use the cached clone.

Building the voting UI itself? [`vocdoni-ui-style`](#-vocdoni-ui-style--vocdoni-look-and-feel) (listed under the team skills) carries the product look of the Vocdoni app, including the white-label accent for an organization's own color.

---

## Skills for the Vocdoni team

Tooling we use internally for our own development workflow. Nothing stops you from installing these, but they target how *we* work rather than the Vocdoni platform.

### 🐹 `vocdoni-go` — Go engineering

| Skill                | What it covers                                                            |
| -------------------- | ------------------------------------------------------------------------- |
| `go-best-practices`  | Rob Pike's *Go Proverbs* — idiomatic & architectural defaults.            |
| `go-code-quality`    | Production checklist: domain types, error contracts, context, goroutines. |
| `go-modern`          | Version-aware modern Go syntax. Reads `go.mod` to pick the right target.  |

### 💳 `vocdoni-stripe` — Stripe operations for the SaaS

| Skill                 | What it covers                                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stripe-subscription` | Create a subscription for an existing customer through the Stripe CLI (or MCP): prompts for the minimum inputs, clones per-customer *Custom* / *Integrator Starter* plan products, handles discounts and collection, confirms before writing. |

Requires `jq` and either the [Stripe CLI](https://docs.stripe.com/stripe-cli) with a started session (`stripe login`, then `stripe agent setup` for its own skill) or a Stripe MCP server.

### 🔑 `vocdoni-internal-oauth` — staff sign-in for internal tools

| Skill                    | What it covers |
| ------------------------ | -------------- |
| `vocdoni-internal-oauth` | Add Google sign-in for `@vocdoni.org` accounts to an existing internal web tool through the central OpenID Connect provider at `oauth.vocdoni.org`: register the tool as a client in [vocdoni/oauth][oauth], wire the Go kit (`vocauth`) or the Node/TypeScript kit (`@vocdoni/oauth`, Express and Fetch-API frameworks), use any OIDC library or oauth2-proxy for other stacks, develop locally against the dev provider, migrate away from a shared password, rotate cookie keys and troubleshoot. |

### 🎨 `vocdoni-ui-style` — Vocdoni look and feel

| Skill              | What it covers |
| ------------------ | -------------- |
| `vocdoni-ui-style` | Build UIs that look and behave like Vocdoni's products, in its two visual modes: **editorial** (vocdoni.io: cream surfaces, warm ink, Fraunces serif headings, green accent, yellow eyebrow dot) for marketing, landing and docs pages, and **product** (vocdoni-app: white, Inter at light weights, monochrome or white-label accent) for dashboards, voting pages and admin tools. Ships tokens for Tailwind v4 + shadcn/ui, Chakra UI v3 and plain CSS, React components, logo files, reference screenshots, runnable HTML examples (landing, voting flow, dashboard, sign-in, vote builder, transactional email), worked React recipes, step-by-step UX flows for voting, vote building and onboarding, specs for docs sites and result PDFs, copy rules, and a brand style checker (`scripts/check-style.mjs`). |

### 🧭 `agentic-dev` — subagent-driven development with independent audits

| Skill                  | What it covers |
| ---------------------- | -------------- |
| `subagent-driven-development` | How the main session runs any multi-step change that will be merged: size the work (spike / bounded / architectural), write and audit a spec, have a plan drafted and pre-flight audited, dispatch one subagent per task with a strict prompt contract, review every diff, run a whole-branch gate audit, then merge and release only on the owner's OK. Fable is the independent auditor and consultant; a ledger in `.delivery/` survives context compaction. Ships audit and dispatch prompts, spec and plan templates, and `init-workspace.sh` / `task-brief.sh`. |

The plugin also installs a **SessionStart hook** so the model loads the skill on its own for feature, refactor, protocol, migration, multi-repo, deploy and benchmark work, and resumes any unfinished `.delivery/` ledger in the current repo. The hook is Claude Code-only; an npx install gets the skill, which still triggers from its description.

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
claude plugin install vocdoni-sdk@vocdoni
claude plugin install davinci-sdk@vocdoni
claude plugin install vocdoni-integrator-sdk@vocdoni
claude plugin install vocdoni-go@vocdoni
claude plugin install vocdoni-stripe@vocdoni
claude plugin install vocdoni-internal-oauth@vocdoni
claude plugin install vocdoni-ui-style@vocdoni
claude plugin install agentic-dev@vocdoni
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
npx @vocdoni/skills install --plugin integrator-sdk   # remote plugin, cloned on demand
npx @vocdoni/skills install --plugin davinci-sdk      # full name (no vocdoni- prefix)
npx @vocdoni/skills install --plugin agentic-dev        # skill only; the SessionStart hook is Claude Code plugin-only
npx @vocdoni/skills install --plugin ui-style           # 'ui-style' → 'vocdoni-ui-style'

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
│   ├── vocdoni-stripe/
│   │   └── …
│   ├── vocdoni-internal-oauth/
│   │   └── …
│   ├── vocdoni-ui-style/              # skill + tokens, components, logos, examples
│   │   └── …
│   ├── agentic-dev/                    # skill + SessionStart hook (hooks/)
│   │   └── …
│   └── claude-pi-subagent/             # nested marketplace (pi-agent-tools)
│       └── plugins/pi-subagent/        # MCP server plugin + agents — see its README
├── bin/install.js                      # npx CLI (zero deps, Node ≥ 18)
├── package.json                        # Published as @vocdoni/skills
├── README.md
├── CONTRIBUTING.md                     # Authoring guide
└── LICENSE                             # AGPL-3.0-or-later
```

`vocdoni-integrator-sdk` has no directory here — it is a remote plugin whose `source` in `marketplace.json` points at [vocdoni/vocdoni-integrator-sdk][integrator-sdk].

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the skill format, naming rules, and the steps to add a new skill or plugin.

## License

[AGPL-3.0-or-later](./LICENSE).

[skills-docs]: https://docs.claude.com/en/docs/claude-code/skills
[skills-api]: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview
[sdk]: https://github.com/vocdoni/vocdoni-sdk
[davinci-sdk]: https://github.com/vocdoni/davinci-sdk
[integrator-sdk]: https://github.com/vocdoni/vocdoni-integrator-sdk
[oauth]: https://github.com/vocdoni/oauth
[vocdoni]: https://vocdoni.io
[pi]: https://www.npmjs.com/package/@earendil-works/pi-coding-agent
