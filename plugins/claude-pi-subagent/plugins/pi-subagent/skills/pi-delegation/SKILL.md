---
name: pi-delegation
description: Delegate to named Pi subagents and bounded coding tasks via the pi-subagent MCP tools. Use when the user says "use pi-agent <name>", "use pi-subagent <Name>", names a defined agent (e.g. web-scout, reviewer, researcher), asks to research/scout a term, or wants to offload a scoped review/refactor/implementation to Pi. Covers picking and running a named agent, ad-hoc task modes (read-only vs worktree), MCP-backed agents, and never trusting Pi's patch without review.
---

# Delegating to Pi

The `pi-subagent` plugin runs **Pi** as an external subagent. There are two ways to delegate.

## 1. Named pi-agents (preferred when an agent fits)

A pi-agent is a reusable persona defined in a `.md` file (name + model + tools + system prompt). The user invokes one by name:

> Use pi-agent **web-scout** to find out about **Vocdoni**.
> Ask **researcher** about the current state of WebGPU.

**How to handle these:**
1. If you don't know what agents exist, call `pi_list_agents` (returns name, description, model, tools).
2. Call `pi_run_agent { agent: "<name>", input: "<the user's term or task>" }`. The `input` is whatever the user wants the agent to act on — a name, word, topic, or instruction (e.g. `"Vocdoni"`). The agent's own persona decides what to do with it.
3. Return the agent's summary. For agents that edit files, read the diff (see below) before trusting it.

Notes:
- The agent already carries its model (e.g. a `mimo/*` model), tools (including any MCP tools like web search), and instructions — you don't specify those.
- Read-only agents (research/review) run in place; agents that can edit files run in an isolated git worktree automatically.
- `pi_run_agent` blocks until done. Pass `background: true` for long runs, then poll `pi_get_status` / `pi_get_result`.

## 2. Ad-hoc bounded tasks (no named agent)

For one-off coding work, use `pi_run_task` / `pi_start_task` with a mode:

| Mode    | Edits files? | For |
|---------|--------------|-----|
| `ask` / `review` / `plan` | no | questions, code review, plans (read-only) |
| `patch` / `test` | yes (in a worktree) | implementing a change / writing tests |

Default to a read-only mode; only use `patch`/`test` when Pi should modify files, and keep `useWorktree` on.

## When NOT to delegate

- Tiny edits you can do directly (delegation has spawn overhead).
- Work needing full repo context or live conversation with the user.
- Anything outside the project, or needing secrets/deploys — Pi is sandboxed and instructed to refuse these.

## Interpreting results

A result includes `status`, `summary`/`lastAssistantText`, `changedFiles`, `worktreePath`, `diffPath`, a truncated `diffPreview`, and artifact paths (`logPath`, `resultPath`, `sessionFile`). On `failed`/`timeout`, read `error` and the `logPath`.

## Never trust Pi's patch blindly

For any agent or task that edits files:
1. **Read the full diff** at `diffPath` — confirm it does exactly what was asked, with no unrelated edits, secrets, or scope creep.
2. **Verify behavior** (build/tests) rather than trusting the summary.
3. **Apply deliberately** — nothing is applied automatically. Recreate the change yourself, or use `pi_apply_result` only if the user enabled it, then re-run tests.
4. If wrong, `pi_follow_up` with corrections or discard with `pi_cleanup`.

See `reference.md` for the full tool catalog, the agent `.md` format, MCP setup, and how to author new agents.
