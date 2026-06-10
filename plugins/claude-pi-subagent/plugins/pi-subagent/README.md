# pi-subagent

A Claude Code plugin that lets Claude **delegate work to named [Pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) subagents** — reusable personas, each with its own model and tools — and to bounded one-off coding tasks, all driven through Pi's RPC mode.

You define a subagent once as a small Markdown file (a persona + a model + a tool list, optionally including **MCP tools**). Then, from Claude, you say *"use pi-agent **web-scout** to research **Vocdoni**"* and get back a sourced summary produced by Pi. Each run is one isolated Pi process; agents that edit files are sandboxed in a **detached git worktree**, and changes are **never applied to your tree automatically**.

The plugin bundles a local **stdio MCP server**. That server discovers your agents, launches `pi --mode rpc` configured as the chosen agent, drives it to completion over Pi's JSONL protocol, and returns a compact summary plus paths to the full output.

---

## Contents

- [Why use it](#why-use-it)
- [Mental model & architecture](#mental-model--architecture)
- [Quick start](#quick-start)
- [Setup in detail](#setup-in-detail)
  - [1. Pi](#1-pi)
  - [2. A model (e.g. a custom OpenAI-compatible provider)](#2-a-model-eg-a-custom-openai-compatible-provider)
  - [3. MCP tools for agents (pi-mcp-adapter)](#3-mcp-tools-for-agents-pi-mcp-adapter)
  - [4. The plugin](#4-the-plugin)
- [Creating and configuring subagents](#creating-and-configuring-subagents)
- [Real examples](#real-examples)
- [Running agents from Claude](#running-agents-from-claude)
- [Tool reference](#tool-reference)
- [How it works](#how-it-works)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Development](#development)

---

## Why use it

Claude is the orchestrator. Pi is the worker you delegate to. That split is useful when:

- **You want a different or cheaper model to do the legwork.** A subagent declares its own model (for example a self-hosted or third-party OpenAI-compatible model), so research, review, or boilerplate runs there instead of consuming your main session.
- **You want to keep Claude's context clean.** A subagent does its searching/reading/editing in its own process and hands back only a summary and a diff path. The intermediate tool churn never enters your conversation.
- **You want reusable, named specialists.** "web-scout", "reviewer", "code-smith" — define the persona, model, and tools once, then invoke by name with a one-word input.
- **You want MCP tools available to the worker.** Pi (via the MCP adapter) can use MCP servers — web search, browsers, databases — even for tasks you'd rather not wire into Claude directly.
- **You want safe, reviewable changes.** Code-editing agents run in a throwaway git worktree. You get a `diff.patch` to inspect; nothing is applied until you decide.

If you just need Claude to edit a file directly, do that — delegation has process-spawn overhead. Reach for a subagent when the work is bounded, self-contained, and benefits from a separate model, separate context, or MCP tools.

## Mental model & architecture

```
You (in Claude Code)
   │  "use pi-agent web-scout to research Vocdoni"
   ▼
Claude  ──pi_run_agent──►  pi-subagent MCP server   (this plugin, a local stdio process)
                                  │
                                  │  1. discover ~/.pi/agents/web-scout.md
                                  │  2. spawn:  pi --mode rpc
                                  │              --model mimo/mimo-v2.5-pro
                                  │              --system-prompt "<persona + safety>"
                                  │              --tools read,web_search_exa,web_fetch_exa,mcp
                                  │  3. send your input ("Vocdoni") as the message  (JSONL → stdin)
                                  ▼
                            Pi process
                                  │   model: mimo/mimo-v2.5-pro
                                  │   tools: read + Exa MCP (via pi-mcp-adapter)
                                  │   ... searches, fetches, reasons ...
                                  │   emits agent_end
                                  ▼
              summary + changedFiles + diffPath + log  ──►  returned to Claude
```

Key points:

- **One run = one Pi process.** The server spawns Pi per task, talks to it over a strict line-delimited JSON protocol on stdin/stdout, and treats Pi's `agent_end` event as completion.
- **Agents are just Markdown.** They use the same `.md` format as the [`pi-subagents`](https://github.com/nicobailon/pi-subagents) Pi extension, so the same definitions work whether you drive them from Pi or from Claude through this plugin.
- **Isolation by tool.** If an agent can edit files (its tools include `edit`/`write`/`bash`, or it declares no tool list and thus inherits Pi's full toolset), it runs in a detached worktree and its changes are captured as a diff. Read-only agents run in place and never touch your working tree or git index.

## Quick start

Assuming Pi is installed and logged in, and you have a model configured (see [Setup](#setup-in-detail)):

1. Create an agent at `~/.pi/agents/web-scout.md` (full file in [Real examples](#real-examples)).
2. Install the plugin:
   ```text
   /plugin marketplace add ./plugins/claude-pi-subagent
   /plugin install pi-subagent@pi-agent-tools
   /reload-plugins
   /mcp
   ```
3. In Claude:
   > Use pi-agent **web-scout** to research **Vocdoni**.

   Claude calls `pi_run_agent { agent: "web-scout", input: "Vocdoni" }` and returns a sourced summary.

## Setup in detail

### 1. Pi

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
pi            # run once
/login        # authenticate / pick a provider, inside Pi
```

The plugin runs `pi` with your existing Pi auth and configuration. Confirm it works headlessly:

```bash
pi --list-models          # shows the models Pi knows about
pi -p --tools "" "say OK" # a tiny non-interactive run
```

### 2. A model (e.g. a custom OpenAI-compatible provider)

Agents reference a model as `provider/id`. The provider must exist in Pi's model registry, `~/.pi/agent/models.json`. Any OpenAI-compatible endpoint works. Example provider block:

```json
{
  "providers": {
    "mimo": {
      "api": "openai-completions",
      "apiKey": "YOUR_KEY",
      "baseUrl": "https://your-endpoint.example.com/v1",
      "compat": { "supportsDeveloperRole": false, "supportsReasoningEffort": false },
      "models": [
        { "id": "mimo-v2.5-pro", "name": "MiMo V2.5 Pro", "contextWindow": 1048576, "maxTokens": 131072, "reasoning": true },
        { "id": "mimo-v2.5",     "name": "MiMo V2.5",     "contextWindow": 262144,  "maxTokens": 65536,  "reasoning": true }
      ]
    }
  }
}
```

Then an agent can use `model: mimo/mimo-v2.5-pro`. Verify with `pi --list-models mimo`.

> Tip: for OpenAI-compatible backends that reject non-standard parameters, set `compat.supportsReasoningEffort: false` and `compat.supportsDeveloperRole: false`, as shown.

### 3. MCP tools for agents (pi-mcp-adapter)

Pi has **no native MCP client**. MCP works through the [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter) extension. Skip this step if none of your agents use MCP.

Install it once:

```bash
pi install npm:pi-mcp-adapter
```

Declare MCP servers in an `mcp.json` the adapter reads automatically. It reads these standard locations (project-local files take precedence over global ones): `~/.config/mcp/mcp.json`, `~/.pi/agent/mcp.json`, `<project>/.mcp.json`, `<project>/.pi/mcp.json`. Putting it in `~/.pi/agent/mcp.json` makes the servers available to every project. Example using [Exa](https://exa.ai) as a remote search server:

```json
{
  "mcpServers": {
    "exa": {
      "url": "https://mcp.exa.ai/mcp?exaApiKey=YOUR_EXA_KEY",
      "directTools": true,
      "lifecycle": "eager"
    }
  }
}
```

- `url` — a StreamableHTTP (with SSE fallback) MCP endpoint. For stdio servers use `command`/`args` instead. Headers support `${VAR}` interpolation if you prefer not to put the key in the URL.
- `directTools: true` — register the server's tools as **individual Pi tools** (e.g. `web_search_exa`, `web_fetch_exa`) that show up alongside `read`/`bash`.
- A generic **`mcp` proxy tool** is always available regardless of `directTools`. It works on the very first run, before any direct-tool cache is warm.
- `lifecycle: eager` connects at startup; `lazy` connects on first use.

Confirm the adapter and server are visible:

```bash
pi list                                  # should show npm:pi-mcp-adapter
pi -p --tools read,mcp "Use the mcp tool to search exa for 'IPFS' and reply in one sentence."
```

> Direct tools (like `web_search_exa`) populate a metadata cache on first use; until then Pi falls back to the `mcp` proxy automatically. Listing both the direct names and `mcp` in an agent's tools makes it robust either way. Run `/mcp reconnect <server>` inside Pi to warm direct tools immediately.

### 4. The plugin

```text
/plugin marketplace add ./plugins/claude-pi-subagent
/plugin install pi-subagent@pi-agent-tools
/reload-plugins
/mcp
```

Point `/plugin marketplace add` at the directory containing `.claude-plugin/marketplace.json`. Use an absolute path if a relative one does not resolve. `/mcp` should then list the `pi-subagent` server and its tools.

The plugin ships a **prebuilt, dependency-free** `dist/server.mjs`, so there is no `npm install` step after installation. Configure it (model defaults, parallelism, etc.) via `/plugin` — see [Configuration](#configuration).

## Creating and configuring subagents

An agent is a single Markdown file: **YAML-style frontmatter** describing how to launch Pi, followed by a **system-prompt body** describing the persona.

```markdown
---
name: web-scout
description: Researches a name/term/topic on the web and returns a sourced summary
model: mimo/mimo-v2.5-pro
tools: read, web_search_exa, web_fetch_exa, mcp
thinking: medium
systemPromptMode: replace
---

You are Web Scout, a focused web-research subagent.
Your input is a single name, word, or topic. Research it and return a concise, sourced summary.
...
```

### Frontmatter fields

| Field | Required | Meaning |
|-------|----------|---------|
| `name` | yes | The id used to invoke the agent (`pi_run_agent { agent: "<name>" }`). Must be unique within a directory; across directories, later ones win (see discovery order). |
| `description` | no | One-line summary, shown by `pi_list_agents`. Helps Claude pick the right agent. |
| `model` | no* | Pi model as `provider/id` or `provider/id:thinking` (e.g. `mimo/mimo-v2.5-pro`). Falls back to the plugin's `default_model` if omitted. *One of the two must resolve, or the run errors. |
| `tools` | no | Comma-separated allowlist passed to Pi's `--tools`. Entries can be builtins (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`), MCP tool names (`web_search_exa`), the generic `mcp` proxy, or extension paths. **Omit the field entirely** to give the agent Pi's full default toolset. |
| `thinking` | no | Reasoning level: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`. Falls back to `default_thinking`. |
| `systemPromptMode` | no | `replace` (default) gives a clean persona via `--system-prompt`; `append` adds the body onto Pi's base prompt via `--append-system-prompt`. |

### The system-prompt body

The body is the persona. The plugin always appends a short, non-negotiable operating-constraints block (stay in scope; don't touch secrets; don't commit/push/deploy; finish with a clear summary), so you don't need to repeat those.

Write the body to define:

1. **The input contract.** Your agent receives the caller's `input` as its first message — a word, a topic, a claim, or a task. Say explicitly what that input is and what to do with it. Example: *"Your input is a single name, word, or topic. Research it and return a summary."*
2. **The method.** How to use its tools, when to stop, what sources to prefer.
3. **The output shape.** What the final message should contain (the plugin returns the agent's last assistant message as the `summary`). Ask for a self-contained, structured result rather than a tool log.

### Choosing tools

- **Read-only research/review:** `read` + your MCP tools (`web_search_exa`, `web_fetch_exa`, `mcp`). No write tools → the agent runs in place, produces no diff.
- **MCP + writing files:** add `write`. Now the agent is write-capable → it runs in a worktree and any files it creates are captured in `diff.patch`.
- **Coding:** `read, grep, find, ls, edit, write, bash`. Write-capable → worktree + diff.
- **MCP robustness:** include both the direct tool names *and* `mcp` (the proxy) so the agent works whether or not the direct-tool cache is warm.

### Worktree behavior (derived automatically)

| Agent's `tools` | Runs in | Diff captured? |
|-----------------|---------|----------------|
| includes `edit`/`write`/`bash` | detached git worktree | yes (`diff.patch`) |
| field omitted (full default toolset) | detached git worktree | yes |
| read-only (no write tools) | the project directory, in place | no — never stages in your tree |

Override per call with `useWorktree`. In a **non-git** project, a worktree can't be created, so write-capable agents are refused with a clear error; read-only agents still run.

### Where to put agent files (discovery order)

Searched in this order; on a name collision, a later directory wins:

1. `~/.pi/agents/**/*.md` — your personal agents (shared with the `pi-subagents` Pi extension).
2. `<project>/.pi/agents/**/*.md` — project-scoped agents.
3. `<project>/pi-agents/**/*.md` — project alternative.
4. The optional `agents_dir` setting — an extra directory you point at.

Files ending in `.chain.md` are ignored. Subdirectories are searched recursively.

### Create your first agent (step by step)

1. `mkdir -p ~/.pi/agents`
2. Write `~/.pi/agents/web-scout.md` (copy the [Web Scout](#web-scout--read-only-web-research) example).
3. Confirm Pi can resolve its model: `pi --list-models mimo`.
4. In Claude: *"List the available pi-agents"* → it appears. Then *"use pi-agent web-scout to research Vocdoni"*.

## Real examples

These are complete, working agents. Create them under `~/.pi/agents/`. They use a `mimo/*` model and the Exa MCP server from the [setup](#setup-in-detail); swap in your own model/server names.

### web-scout — read-only web research

```markdown
---
name: web-scout
description: Researches a name, term, company, or topic on the web and returns a concise, sourced summary
model: mimo/mimo-v2.5-pro
tools: read, web_search_exa, web_fetch_exa, mcp
thinking: medium
systemPromptMode: replace
---

You are Web Scout, a focused web-research subagent.

Your input is a single name, word, term, company, product, person, or topic (for example: "Vocdoni"). Your job is to find out what it is and return a concise, accurate, sourced summary. You do not edit files.

Use `web_search_exa` to search and `web_fetch_exa` to read a strong source when a snippet is not enough. If those tools are not directly available, use the generic `mcp` proxy to call them on the `exa` server.

Method: one or two targeted searches, fetch only the strongest sources, stop once you can describe the subject confidently.

Return: **What it is** (1–2 sentences), **Key facts** (3–6 bullets), **Sources** (the URLs you used), **Confidence / caveats**.
```

**Invoke:** *"use pi-agent web-scout to research Vocdoni"* → `pi_run_agent { agent: "web-scout", input: "Vocdoni" }`

**Sample result** (abridged):

> **What it is:** Vocdoni is an open-source, blockchain-based digital voting protocol designed to provide secure, private, censorship-resistant, and universally verifiable online voting for organizations of any size.
> **Key facts:** built on Ethereum/IPFS/Tendermint + zero-knowledge proofs; supports AGMs, referendums, participatory budgets, ranked-choice; `vocdoni-node` is written in Go; MIT-licensed with a full audit trail …
> **Sources:** https://vocdoni.io/ , https://developer.vocdoni.io/ , https://github.com/vocdoni/vocdoni-node

This agent is read-only, so it runs in place and produces no diff.

### fact-checker — read-only claim verification

```markdown
---
name: fact-checker
description: Verifies a factual claim against web sources (Exa) and returns a verdict with evidence
model: mimo/mimo-v2.5
tools: read, web_search_exa, web_fetch_exa, mcp
thinking: medium
systemPromptMode: replace
---

You are Fact Checker. Your input is a single factual claim (for example: "Vocdoni is built on the Ethereum blockchain"). Verify it against reputable web sources. You do not edit files.

Search for evidence (use `web_search_exa`, or the `mcp` proxy on the `exa` server), fetch the strongest 1–2 sources, then compare what they say against the exact claim.

Return: **Verdict** (`True` / `Partly true` / `False` / `Unverifiable`), **Why** (1–3 sentences citing the sources, including nuance), **Sources** (URLs). Do not overstate confidence.
```

**Invoke:** `pi_run_agent { agent: "fact-checker", input: "IPFS uses content addressing" }`

### doc-writer — MCP research **plus** writing a file

```markdown
---
name: doc-writer
description: Researches a topic on the web (Exa) and writes a concise, sourced markdown brief file
model: mimo/mimo-v2.5
tools: read, write, web_search_exa, web_fetch_exa, mcp
thinking: medium
systemPromptMode: replace
---

You are Doc Writer. Your input is a topic. Research it on the web and WRITE a concise, well-sourced markdown brief as a file in the current working directory.

Research with `web_search_exa` / `web_fetch_exa` (or the `mcp` proxy on `exa`); keep it focused.

Write a file named `<slug>-brief.md` containing a `# Title`, an `## Overview` (2–4 sentences), `## Key points` (4–6 bullets), and a `## References` list. Write only that one file. Do not modify anything else.

Report back: the file path, a one-line description, and the number of sources used. Do not paste the full file.
```

**Invoke:** `pi_run_agent { agent: "doc-writer", input: "libp2p" }`

Because it has the `write` tool, it runs in a worktree. The brief lands there and is captured as a diff; your working tree is untouched. The `result` lists the new file in `changedFiles` and gives a `diffPath`. Example file it produced:

```markdown
# libp2p

## Overview
libp2p is a modular, open-source network stack for building decentralized peer-to-peer
applications. It originated as the wire protocol for IPFS and was spun off by Protocol Labs ...

## Key points
- Modular design: swappable transports, security, multiplexers, discovery.
- Transport-agnostic: TCP, QUIC, WebSocket, WebRTC, WebTransport.
- Secure by default: TLS 1.3 / Noise; peers identified by cryptographic PeerIDs.
- ...

## References
- https://libp2p.io/
- https://libp2p.io/docs/
```

### code-smith — a scoped code change

```markdown
---
name: code-smith
description: Implements a small, well-scoped code change in the working directory and reports the diff
model: mimo/mimo-v2.5
tools: read, grep, find, ls, edit, write, bash
thinking: medium
systemPromptMode: replace
---

You are Code Smith, a focused implementation subagent.

Your input is a single, concrete, bounded coding task. Implement exactly that and nothing more.

Inspect before editing; match the surrounding style. Make the smallest change that fully satisfies the task — no unrelated refactors or reformatting. You may run a single cheap check with `bash`. Do not commit, push, or change git state.

Report: **Change** (1–2 sentences), **Files**, **Verification** (what you checked), **Notes**. Do not paste the whole diff.
```

**Invoke:** `pi_run_agent { agent: "code-smith", input: "Add an exported function multiply(a, b) to src/math.js, mirroring the existing add()." }`

It runs in a worktree. Example captured `diff.patch`:

```diff
diff --git a/src/math.js b/src/math.js
@@ -2,3 +2,8 @@
 export function add(a, b) {
   return a + b;
 }
+
+/** Multiplies two numbers. */
+export function multiply(a, b) {
+  return a * b;
+}
```

Review the diff, then recreate the change in your real tree (or, if you enabled `allow_apply_tool`, apply it with `pi_apply_result` and re-run your tests).

## Running agents from Claude

Just ask in natural language and Claude maps it to a tool call:

> Use pi-agent **web-scout** to find out about **Tendermint**.
> Ask **fact-checker** whether *"libp2p supports QUIC"*.
> Have **doc-writer** write a brief on **CRDTs**.
> Run **code-smith**: add a `clamp(x, lo, hi)` helper to `src/util.js`.

`pi_run_agent` parameters:

| Param | Default | Meaning |
|-------|---------|---------|
| `agent` | — | Agent name (required). |
| `input` | — | The term/topic/task for the agent (required). |
| `model` | agent's model | Override the model for this run. |
| `thinking` | agent's / default | Override thinking level. |
| `useWorktree` | derived from tools | Force worktree on/off. |
| `timeoutSeconds` | `default_timeout_seconds` | Per-run wall-clock limit. |
| `maxDiffChars` | 12000 | Truncation limit for the inlined diff preview. |
| `background` | `false` | Return immediately with a running task; poll with `pi_get_status`, read with `pi_get_result`. |

Long or parallel work: set `background: true`, then poll. Up to `max_parallel_tasks` runs execute concurrently; a further start is rejected with a clear capacity error until one finishes or is cancelled.

## Tool reference

All tools are exposed by the bundled `pi-subagent` MCP server.

**Agents**

- `pi_list_agents` — list discoverable agents (`name`, `description`, `model`, `tools`, `source`). No inputs.
- `pi_run_agent { agent, input, model?, thinking?, useWorktree?, timeoutSeconds?, maxDiffChars?, background? }` — run a named agent.

**Ad-hoc bounded tasks**

- `pi_run_task { task, mode?, files?, tools?, provider?, model?, thinking?, useWorktree?, timeoutSeconds?, maxDiffChars? }` — delegate a one-off coding task and wait. Modes: `ask`/`review`/`plan` (read-only), `patch`/`test` (worktree, write-capable).
- `pi_start_task { … }` — same, non-blocking; returns a `taskId`.

**Lifecycle (work on any run's `taskId`)**

- `pi_get_status { taskId }` — live status, streaming flag, elapsed, output preview, recent tool activity.
- `pi_get_result { taskId, maxDiffChars? }` — full structured result.
- `pi_steer { taskId, message }` — inject a correction into a running run.
- `pi_follow_up { taskId, message, timeoutSeconds?, maxDiffChars? }` — continue the same Pi session.
- `pi_cancel { taskId }` — abort a run (artifacts kept).
- `pi_list_tasks` — list all runs.
- `pi_cleanup { taskId?, removeWorktree? }` — stop a run, remove its worktree and run directory. Omit `taskId` to clean all finished runs.
- `pi_apply_result { taskId }` — apply a completed run's `diff.patch` via `git apply --3way`. Only registered when `allow_apply_tool` is enabled.

**Result object** (`pi_get_result` / `pi_run_agent`):

```jsonc
{
  "taskId": "pi-…",
  "status": "completed | running | failed | timeout | cancelled",
  "agentName": "web-scout",       // present for agent runs
  "mode": "review",               // review/patch (agents) or the task mode
  "summary": "…",                 // the agent's final message
  "lastAssistantText": "…",
  "changedFiles": [{ "status": "M", "path": "src/math.js" }],
  "worktreePath": "…/.claude/pi-runs/<id>/worktree",  // worktree runs only
  "diffPath": "…/diff.patch",                          // worktree runs only
  "diffPreview": "…(truncated)…",
  "diffTruncated": false,
  "resultPath": "…/result.json",
  "logPath": "…/task.log",
  "sessionFile": "…/session/<uuid>.jsonl",
  "startedAt": "…", "endedAt": "…",
  "error": "…"                    // on failed/timeout
}
```

## How it works

- **Dispatch.** For a named agent, the server reads the `.md`, resolves the effective model (call override → agent → default), sanitizes the tool list, composes the system prompt (persona body + the operating-constraints block), and decides worktree use from the tools. It then launches `pi --mode rpc` with `--model`, `--system-prompt`/`--append-system-prompt`, `--tools`, `--thinking`, and `--session-dir`, and sends your `input` as the first message.
- **Protocol.** The server speaks Pi's strict line-delimited JSON (LF-only framing; record strings may legally contain other Unicode separators, so it splits on `\n` only). It correlates command responses by id and watches the event stream.
- **Completion.** Pi's `agent_end` event marks the end of a run. The server then re-checks Pi's state to absorb auto-retry restarts, so a transient model retry doesn't look like completion. A per-run timeout bounds everything.
- **Isolation & diff.** Write-capable runs get a detached worktree (`git worktree add --detach HEAD`) under `<project>/.claude/pi-runs/<id>/worktree`. The diff is captured there with `git add -A` + `git diff --binary --cached` (a complete patch including new files). This staging happens **only inside the worktree** — in-place and read-only runs never run `git add` in your working tree, so they produce no diff and leave your git index untouched.
- **Artifacts.** Each run writes `<project>/.claude/pi-runs/<id>/`:
  - `task.log` — every Pi RPC stdout line and stderr chunk.
  - `result.json` — the latest result object.
  - `session/` — Pi's session JSONL.
  - `worktree/` and `diff.patch` — worktree runs only.
- **Safety.** Pi is spawned without a shell (explicit argv), and the persona is wrapped with constraints against secrets access, commits/pushes, and destructive commands. Nothing is applied to your tree automatically.

Add `.claude/pi-runs/` to your project's `.gitignore`.

## Configuration

Set via `/plugin` (values reach the server as environment variables):

| Option | Default | Meaning |
|--------|---------|---------|
| `pi_path` | `pi` | Path to the Pi executable (absolute if not on PATH for the server process). |
| `default_provider` | `""` | Default Pi provider (empty = Pi's own default). |
| `default_model` | `""` | Default model, used when an agent or task declares none. |
| `default_thinking` | `medium` | Default thinking level. |
| `max_parallel_tasks` | `2` | Max concurrent running runs. |
| `default_timeout_seconds` | `900` | Per-run wall-clock timeout. |
| `use_worktrees_by_default` | `true` | Worktree default for write-capable runs. |
| `allow_apply_tool` | `false` | Register `pi_apply_result`. |
| `agents_dir` | `""` | Extra directory of agent `.md` files (searched besides the defaults). |

## Troubleshooting

- **"Unknown pi-agent '<x>'"** — run `pi_list_agents`. The file must sit in a searched directory with valid frontmatter and a `name`. The error lists the searched directories.
- **Agent fails immediately / "Pi process exited"** — check `pi_path`, that `pi` is on PATH for the server, and Pi auth (`pi` → `/login`). The `error` field includes a Pi stderr tail; `logPath` has the full transcript.
- **Agent model error** — the agent's `model` must exist in Pi's config: `pi --list-models`. Add the provider to `~/.pi/agent/models.json`.
- **MCP tools do nothing** — ensure `pi install npm:pi-mcp-adapter` ran, the server is in an `mcp.json` the adapter reads, and the agent's `tools` include the tool names or the `mcp` proxy. The first run may use the proxy until the direct-tool cache warms; `/mcp reconnect <server>` warms it.
- **Agent loops on the same MCP tool call / times out with empty output** — almost always a weak/non-reasoning model fighting the `mcp` proxy (whose `args` must be a JSON *string*, not an object). Fix it in the agent: list the **exact prefixed** direct-tool names (`jina_search_web`, `tavily_tavily_search`, … — see `~/.pi/agent/mcp-cache.json` for per-server names, and add them to `directTools` in `mcp.json`) so the model calls flat tools with normal object args and never touches the proxy. See the skill's `reference.md` → "Authoring robust MCP-backed agents."
- **`timeout`** — raise `timeoutSeconds`, narrow the agent's task, or pick a faster model.
- **"not a git repository" for a write agent** — initialize git, use a read-only agent, or pass `useWorktree: false` to run in place (no isolation).
- **Empty/echoed summary** — usually the model produced no output (provider/auth/network error). Inspect `logPath`.
- **Stale worktrees after a crash** — `git worktree prune`, then remove `.claude/pi-runs/`.

## Security

- **Nothing is applied automatically.** You review diffs and apply deliberately. `pi_apply_result` is off unless you enable `allow_apply_tool`.
- Pi runs without a shell wrapper and is instructed not to commit/push, change git config/remotes, access secrets/`.env`/keys, or run deploy/network-destructive commands.
- Agent tool names are sanitized (safe characters only); task paths are validated to stay within the project (NUL bytes, parent escapes, and system paths are rejected).
- API keys for models and MCP servers live in Pi's own config files (`models.json`, `mcp.json`), owner-readable only — not in the plugin.

## Development

```bash
npm install        # dev dependencies
npm run typecheck  # tsc --noEmit (strict)
npm test           # vitest
npm run build      # tsup → dist/server.mjs (bundled, standalone)
claude plugin validate . --strict   # from the marketplace root
```

Commit `dist/server.mjs` so the plugin runs without a build step (`git add -f` if an enclosing `.gitignore` excludes `dist/`).

### Layout

```
pi-subagent/
  .claude-plugin/plugin.json   # manifest + userConfig
  .mcp.json                    # MCP server definition (${CLAUDE_PLUGIN_ROOT}/dist/server.mjs)
  src/
    server.ts                  # MCP tools
    agents.ts                  # agent discovery + frontmatter parsing + run planning
    pi-task-manager.ts         # run lifecycle (spawn, await, finalize, diff)
    pi-rpc-client.ts           # Pi --mode rpc client (JSONL framing, events)
    worktree.ts / git.ts       # worktree isolation + diff capture
    paths.ts / config.ts / schemas.ts / result-format.ts / safe-process.ts / types.ts
  dist/server.mjs              # bundled server (committed)
  skills/pi-delegation/        # SKILL.md + reference.md
  agents/pi-delegator.md       # delegation agent
  test/                        # vitest suites
```

## License

MIT
