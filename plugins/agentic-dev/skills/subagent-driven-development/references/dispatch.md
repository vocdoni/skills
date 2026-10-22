# Dispatching implementers, fixers and reviewers

## Contents
- Choosing the model role for a task
- Implementer prompt contract
- Project constraints block
- Report contract
- Handling a report
- Fix rounds and escalation ladder
- Task-reviewer prompt (large tasks)

## Choosing the model role for a task

This applies the roles table in SKILL.md section 2 to a single task. The ledger's `Models:` line
turns the model role into the Agent tool's `model` value ([models.md](models.md)).

| The task is… | Model role |
|---|---|
| fully specified code to transcribe, vendoring, a rename, a single-file edit | fast model |
| a normal plan task: multi-file, some integration judgement | standard model |
| concurrency, soundness, cryptography, a security path, or a fix after a Critical finding | strong model |

When a patch file is present in the brief, the model role reflects what the implementer does with
it, not the task's original complexity:

| Patch situation | Model role |
|---|---|
| patch applies cleanly and tests pass | fast model |
| patch does not apply or tests fail; implementer adapts minimally | standard model |

When in doubt, pick the cheaper model role and let the escalation ladder catch failures. The
exception is security-sensitive code, which starts at the strong model.

## Implementer prompt contract

Every implementer prompt has these parts, in this order. Implementers start with no context, so
anything left out of the prompt or the brief does not exist for them.

```
You are implementing Task <N> of <plan title>: <one line on where this task fits>.

Read your task brief first: <workspace>/task-<N>-brief.md
It is your single source of requirements. Amendments from the audit are already in its
"Rulings" section, cited by finding number.

Context:
- Interfaces from earlier tasks: <exact names and signatures, with file:line>
- Decisions already made: <short list>
- Running concurrently, do not touch: <files, dirs, processes, or "nothing">

Constraints:
- Repo <path>, branch <branch> (already checked out; if you were started in a worktree, that
  worktree and its branch are yours). Never push, never switch branches, never run git stash.
- Commit with explicit paths only: git commit -m "<msg>" -- <paths>. Never git add -A or git add .
- Commit messages: conventional commits "type(scope): lowercase summary"; no AI attribution, no
  Co-Authored-By or similar trailers. <or the repo's own rule, verbatim>
- Do not edit the plan, the ledger or anything under .delivery/ except your own report.
- Do not weaken, skip or delete tests to get to green. Report the failure instead.
- Do not use shared or metered resources (GPU, clusters, provers, paid APIs, production
  endpoints) unless your brief says so.
- Build output never in /tmp; use the project target dir or ~/.cache/<project>/.
- Never print, log or commit secrets, keys, tokens or full credentialed URLs.
- Do not touch untracked files you did not create; they belong to the owner.
- Kill every process you start before you finish.
- Gated or ignored tests must actually run: check the output for skip lines.
<project constraints block, see below>

If the brief names a `Patch:` file, apply it first: `git am -3 <patch>`. Run the task's tests.
If the patch applies cleanly and tests pass, you are done — commit as directed. If the patch
does not apply or tests fail, adapt the code minimally to make tests pass and record each
deviation in your report. Rulings in the "Rulings for this task" section override the patch:
amend the applied code to satisfy the ruling and record the change. If the brief carries no
patch, follow the task's code as written.

If the brief's code doesn't compile against the real tree, adapt it minimally and record the
deviation in your report. If an interface that other tasks rely on would have to change, stop
and reply NEEDS_CONTEXT with the reason. Do not redesign.

When a patch from an earlier task was modified during fix rounds after that task closed, later
patches may not apply cleanly. `git am -3` resolves most such conflicts; when it cannot, adapt
as above and report the deviation so the controller can update the plan.

You do not dispatch subagents.

Write your full report to <workspace>/task-<N>-report.md (format below). Your reply to me is
under 12 lines: status, commit SHAs, a one-line test summary, concerns, and the report path.
Status is one of: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED.
```

## Project constraints block

Fill this in from CLAUDE.md, the spec's constraints and the plan's Global Constraints. It is the
part that makes the generic contract fit a specific project. Some typical entries:

- Allowed resources: "Task 6 may use the GPU on this host; nothing else may."
- Network: "No calls to mainnet; use <testnet or mock>. Never print full RPC URLs (they embed keys)."
- Specialised agents: "Code mapping uses the <name> agent type, not Explore."
- Async runtimes: "CPU-heavy work goes on a blocking pool, never on the async executor."
- Toolchain: "Use <toolchain/version>; run <formatter> and <linter> before committing."
- Data: "Do not regenerate fixtures or golden files unless the brief says so."

## Report contract

```
# Task <N> report
Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
Commits: <sha> <title>, ...
## What changed
<files and the reason for each, 1 line per file>
## TDD evidence
<the failing test before the change (name and failure line), then passing after>
## Test output (tail)
<exact commands and the last lines of output, including counts and any skip lines>
## Deviations from the brief
<each one with the reason, or "none">
## Concerns
<anything the controller should look at, or "none">
```

## Handling a report

- **DONE**: review the diff (SKILL.md section 7). If it is clean, write
  `Task N: complete (<sha>, review clean)` in the ledger.
- **DONE_WITH_CONCERNS**: read the concerns first. They often point at the defect.
- **NEEDS_CONTEXT**: answer from the plan, the spec or a ruling, and send it with SendMessage to
  the same implementer. If the question exposes a gap in the plan, record a ruling first.
- **BLOCKED**: diagnose before you re-dispatch. Is the plan wrong, the environment broken, or the
  model too weak? Fix the cause, then follow the ladder.

## Fix rounds and escalation ladder

| Round | Who | How |
|---|---|---|
| 1–3 | the same implementer | SendMessage with the findings: file:line, what is wrong, the expected behaviour. It keeps its context. |
| 4–5 | a fresh implementer on the next model role up that resolves to a different model (fast → standard → strong) | New dispatch: the brief, the current diff, a summary of the failed rounds and what was tried. |
| after 5 | controller | Stop and rethink: the task is probably mis-specified. Consult the auditor, re-scope the task with a ruling, or ask the owner if the spec is wrong. |

Each round's findings must be specific. "Tests fail" is not a finding. Give the failing test,
its assertion and your diagnosis.

## Task-reviewer prompt (large tasks)

Use this for diffs too large to review line by line yourself. You still read the security-relevant
parts yourself.

```
Review the diff for Task <N> of <plan>. You are read-only and do not dispatch subagents.
Brief: <workspace>/task-<N>-brief.md   Diff: git -C <repo> diff <base>..<sha>
Check: the brief's requirements are all met and nothing extra was added; the rulings were
applied; the Global Constraints were respected; the tests test behaviour and really ran; there
are no debug leftovers. Write findings (Critical/Important/Minor, file:line, fix) to
<workspace>/task-<N>-review.md. Reply in under 8 lines.
```
