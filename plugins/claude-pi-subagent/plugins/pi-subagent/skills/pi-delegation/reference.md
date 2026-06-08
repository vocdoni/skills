# Pi delegation — reference

Full reference for the `pi-subagent` MCP tools, configuration, and workflows. Read
`SKILL.md` first for when/why to delegate.

## Tool catalog

All tools are exposed by the bundled MCP server `pi-subagent`.

### `pi_list_agents` — list named agents
No inputs. Returns each discoverable agent's `name`, `description`, `model`, `tools`, and `source` path.

### `pi_run_agent` — run a named agent
Inputs: `agent` (required), `input` (required — the term/topic/task, e.g. `"Vocdoni"`), optional `model`,
`thinking`, `useWorktree`, `timeoutSeconds`, `maxDiffChars`, `background`. Launches Pi configured as the
agent (its model, system prompt, and tools) and runs it against `input`. Returns the agent's result
(`agentName` is set). Blocks unless `background: true`.

### `pi_run_task` — run and wait
Delegate a task and block until Pi finishes. Returns the full result.

Inputs: `task` (required), `mode` (`ask|review|plan|patch|test`, default `ask`), `files[]`,
`tools[]`, `provider`, `model`, `thinking` (`off|minimal|low|medium|high|xhigh`),
`useWorktree`, `timeoutSeconds`, `maxDiffChars`.

### `pi_start_task` — run in background
Same inputs as `pi_run_task`, but returns immediately with a `taskId` and `running` status.
Poll `pi_get_status`; read the outcome with `pi_get_result`. Use for long tasks or to run
several in parallel (bounded by `max_parallel_tasks`).

### `pi_get_status` — live status
Input: `taskId`. Returns `status`, `isStreaming`, `elapsedMs`, a `preview` of Pi's latest
output, `recentTools` (recent tool activity), and `changedFileCount`.

### `pi_get_result` — full result
Inputs: `taskId`, optional `maxDiffChars`. Returns the structured `TaskResult` (see below).

### `pi_steer` — correct a running task
Inputs: `taskId`, `message`. Injects a steering instruction mid-run. Only valid while the
task is streaming.

### `pi_follow_up` — continue a session
Inputs: `taskId`, `message`, optional `timeoutSeconds`, `maxDiffChars`. If the task is idle,
starts a new run on the **same Pi session** (preserving context) and waits. If it is still
running, the message is queued.

### `pi_cancel` — abort
Input: `taskId`. Aborts the run and stops Pi. Any changes made so far are still captured as a
diff; artifacts are kept until `pi_cleanup`.

### `pi_list_tasks` — list
Lists all known tasks with status, mode, changed-file count, and worktree path.

### `pi_cleanup` — remove artifacts
Inputs: optional `taskId`, optional `removeWorktree` (default `true`). Stops Pi, removes the
git worktree, and deletes the run directory. Omit `taskId` to clean all non-running tasks.

### `pi_apply_result` — apply a diff (opt-in)
Input: `taskId`. Applies a completed task's `diff.patch` into the project via
`git apply --3way`. **Only registered when `allow_apply_tool` is enabled.** Review the diff
first; re-run tests after applying.

## Named pi-agents

An agent is a Markdown file: YAML-style frontmatter + a system-prompt body. Same format as the
[`pi-subagents`](https://github.com/nicobailon/pi-subagents) Pi extension, so definitions are portable.

**Discovery order** (later wins on name collisions): `~/.pi/agents` → `<project>/.pi/agents` →
`<project>/pi-agents` → the optional `agents_dir` setting. Files are read recursively; `*.chain.md` is ignored.

**Frontmatter**

| Field | Meaning |
|-------|---------|
| `name` | Invocation id (required). |
| `description` | One-line summary. |
| `model` | `provider/id[:thinking]` (e.g. `mimo/mimo-v2.5-pro`). Falls back to `default_model`. |
| `tools` | Comma list → Pi `--tools`: builtins, MCP tool names, the `mcp` proxy, extension paths. Omit → Pi's full default toolset. |
| `thinking` | `off`/`minimal`/`low`/`medium`/`high`/`xhigh`. |
| `systemPromptMode` | `replace` (clean persona, default) → `--system-prompt`; `append` → `--append-system-prompt`. |

**Run mapping.** `pi_run_agent` launches one `pi --mode rpc` with `--model`, the composed system prompt
(persona body + a short operating-constraints block), and `--tools`; your `input` is sent as the message.
Agents that can edit files (`tools` include `edit`/`write`/`bash`, or `tools` omitted) default to a git
worktree; read-only agents run in place.

### Authoring an agent

Create `~/.pi/agents/<name>.md`:

```markdown
---
name: web-scout
description: Researches a name/term/topic and returns a sourced summary
model: mimo/mimo-v2.5-pro
tools: read, web_search_exa, web_fetch_exa, mcp
thinking: medium
systemPromptMode: replace
---
You are Web Scout. Your input is a name/word/topic. Research it with the Exa web tools and
return: what it is, key facts, the source URLs, and a confidence note. Do not edit files.
```

Then from Claude: *"use pi-agent web-scout to research Vocdoni"*.

## MCP tools in agents (pi-mcp-adapter)

Pi has no native MCP client. Install the adapter once (`pi install npm:pi-mcp-adapter`) and define servers
in an `mcp.json` it auto-reads (`~/.pi/agent/mcp.json`, `<project>/.pi/mcp.json`, `<project>/.mcp.json`,
`~/.config/mcp/mcp.json`):

```json
{
  "mcpServers": {
    "exa": { "url": "https://mcp.exa.ai/mcp?exaApiKey=YOUR_KEY", "directTools": true, "lifecycle": "eager" }
  }
}
```

- `directTools: true` → register the server's tools as individual Pi tools (`web_search_exa`, …).
- A generic **`mcp` proxy tool** is always available (no cache warming). List both direct names and `mcp`
  in an agent's `tools` so it works warm or cold; warm direct tools with `/mcp reconnect <server>`.

## TaskResult shape

```jsonc
{
  "taskId": "pi-...",
  "status": "completed | running | failed | timeout | cancelled",
  "mode": "review",
  "summary": "…",                // Pi's final message (the structured REPORT)
  "lastAssistantText": "…",
  "changedFiles": [{ "status": "M", "path": "src/a.ts" }],
  "worktreePath": "…/.claude/pi-runs/<id>/worktree",
  "diffPath": "…/.claude/pi-runs/<id>/diff.patch",
  "diffPreview": "…(truncated to maxDiffChars)…",
  "diffTruncated": false,
  "resultPath": "…/.claude/pi-runs/<id>/result.json",
  "logPath": "…/.claude/pi-runs/<id>/task.log",
  "sessionFile": "…/.claude/pi-runs/<id>/session/<uuid>.jsonl",
  "startedAt": "…", "endedAt": "…",
  "error": "…"                   // present on failed/timeout
}
```

## Run artifacts

Everything for a task lives under `<project>/.claude/pi-runs/<taskId>/`:

- `worktree/` — the isolated detached git worktree (patch/test edits land here).
- `diff.patch` — complete binary patch (`git add -A` + `git diff --binary --cached`), **worktree runs only**.
- `result.json` — the latest `TaskResult`.
- `task.log` — every Pi RPC stdout line and stderr chunk.
- `session/` — Pi's session JSONL.

Diff capture (which stages files) happens **only inside the isolated worktree** — in-place and
read-only runs never run `git add` in your working tree, so they produce no diff and leave your git
index untouched.

Add `.claude/pi-runs/` to the project's `.gitignore`.

## Configuration (plugin userConfig)

Set via `/plugin` configuration; surfaced to the server as env vars.

| Option | Default | Meaning |
|--------|---------|---------|
| `pi_path` | `pi` | Path to the Pi executable. |
| `default_provider` | `""` | Provider (empty = Pi's default). |
| `default_model` | `""` | Model pattern/id (empty = Pi's default). |
| `default_thinking` | `medium` | Thinking level. |
| `max_parallel_tasks` | `2` | Max concurrent running tasks. |
| `default_timeout_seconds` | `900` | Per-run wall-clock timeout. |
| `use_worktrees_by_default` | `true` | Isolate in a worktree by default. |
| `allow_apply_tool` | `false` | Register `pi_apply_result`. |
| `agents_dir` | `""` | Extra directory of agent `.md` files (searched besides the defaults). |

## Example workflows

**Read-only review:**
> Use Pi to review `src/auth` for security issues. Do not modify files.

→ `pi_run_task { task: "Review src/auth for security issues …", mode: "review",
files: ["src/auth"] }` → read `summary`; no diff expected.

**Isolated implementation, reviewed before applying:**
> Use Pi to implement retry logic in an isolated worktree and show me the diff.

→ `pi_run_task { task: "Implement retry with backoff in src/http.ts …", mode: "patch" }`
→ read `diffPath` → verify → recreate in the real tree (or `pi_apply_result` if enabled) →
run tests.

**Parallel + long-running:**
→ `pi_start_task` several scoped tasks → `pi_get_status` to watch → `pi_get_result` each →
`pi_cleanup` when done.

## Troubleshooting

- **`failed` immediately / "Pi process exited"** — check `pi_path`, that `pi` is on PATH for
  the server, and Pi auth (`pi` → `/login`). The `error` field includes a Pi stderr tail.
- **`timeout`** — raise `timeoutSeconds`, narrow the task, or split it.
- **"not a git repository"** in patch/test — initialize git, use a read-only mode, or
  `useWorktree:false` to run in place (no isolation).
- **Empty/echoed `lastAssistantText`** — usually means the model produced no output (e.g. a
  provider/auth/network error); inspect `logPath`.
- **Stale worktrees** after a crash — `git worktree prune`, then remove `.claude/pi-runs/`.
- **"Unknown pi-agent"** — check `pi_list_agents`; the file must be in a searched dir with valid frontmatter and a `name`.
- **Agent's MCP tools do nothing** — ensure `pi install npm:pi-mcp-adapter` ran, the server is in `mcp.json`, and the agent's `tools` include the tool names or the `mcp` proxy. First run may use the proxy until the direct-tool cache warms.
- **Agent model error** — the agent's `model` must exist in Pi's config (`pi --list-models`). Add the provider to `~/.pi/agent/models.json`.
