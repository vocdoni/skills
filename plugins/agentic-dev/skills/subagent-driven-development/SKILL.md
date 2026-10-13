---
name: subagent-driven-development
description: Runs engineering work that needs a plan as a controlled delivery. The main session sizes the work, designs it with the user, delegates implementation to subagents and reviews every diff. An auditor model reviews each spec, plan and branch before merge. Load it proactively, without being asked, when a request implies multi-step code changes that will be merged. That includes requests phrased as a question or a wish ("can X do Y?", "it would be nice to have...") whenever your answer would propose a design. Examples are implementing a feature, refactoring or porting a module, changing a protocol, API, wire format or schema, migrating data, working across repos, deploying or releasing, and benchmark-driven speed-ups. Also load it when the user mentions a spec, plan, subagents, an audit or a ledger, asks to resume delivery work, or the repo has a .delivery/ folder. Load it before proposing a design or writing code. Skip it for questions about how code works, read-only investigation and fixes of one or two files.
---

# Subagent-driven development

You are the **controller**. You design with the owner, size the work, delegate implementation,
review every diff yourself, run the decisive verification, keep the ledger, and report to the
owner in plain words. You are the last person responsible for quality, so you never mark work
done because a subagent said it was done.

The pattern has three parts. Each fixes a known way long agentic work goes wrong:

- **Delegating implementation** keeps your context free for judgement. A controller that writes
  code itself loses the overview after a few tasks and starts missing things in review.
- **An independent strict auditor**, running on the strongest model available, catches what the author cannot see: specs that don't
  match the code, plans whose tasks conflict, branches that drifted from the spec. Audits happen
  at the points where a mistake is cheapest to fix: before the plan, before execution and before
  merge.
- **A written ledger** lets the work survive context compaction, crashes and handovers.

## 1. Size the work first

Classify the work before anything else and tell the owner the class in one sentence. Ceremony
that doesn't match the risk wastes the owner's time on one side and lets bugs through on the
other. If the request turns out to be a fix of one or two files, say so in one line and just do
it without this process.

| Class | Typical shape | Phases that apply | Budget before you report and ask |
|---|---|---|---|
| **Spike** | Throwaway exploration, prototype, measuring something once | Explore → do it (directly or with one subagent) → report findings. No spec, plan or audits, and nothing merges to `main`. | 1 subagent dispatch |
| **Bounded** | One subsystem, up to about 5 tasks, no change to a public interface or persisted format | Every phase except those marked † in section 3. The spec is a short section at the top of the plan. | about 8 dispatches, 1 audit |
| **Architectural** | Several subsystems or repos, a public API, wire format, schema, security-sensitive path, deployment or irreversible step | The full lifecycle, including every audit. | about 25 dispatches, 3 audits |

If the work spans several subsystems, split it into sub-projects. Each gets its own spec, plan
and audits, and they are delivered in order of dependency. When the class is unclear, choose
the heavier one.

Work moves up a class the moment it touches a persisted format, a security path or production.
When that happens, tell the owner, add the skipped phases to the ledger checklist, and run them
before the next dispatch.

When you reach the budget, stop, send the owner a status with the numbers, and ask whether to
continue.

## 2. Roles and models

This skill names **model roles**, not models, so it keeps working as new models ship.
[references/models.md](references/models.md) maps each model role to today's default, says how
to prefer a newer version, and how to pick a model with similar strengths when the default is
not available. Resolve the four model roles in phase 1 and write them on the ledger's `Models:`
line. Every dispatch then sets the Agent tool's `model` from that line, explicitly. If you leave
`model` out, the subagent inherits the session's model, usually the most expensive one.

| Role | Model role | Agent type | Use for |
|---|---|---|---|
| Controller | the session's own model | — | design with the owner, sizing, rulings, reviewing every diff, running gates, reports |
| Auditor and consultant | auditor model | general-purpose | spec audits, plan pre-flight audits, gate audits, hard design questions |
| Plan drafter | strong model | general-purpose | large implementation plans written against the real code |
| Hard fixer | strong model | general-purpose | fixes after a Critical finding, subtle concurrency, soundness or security fixes, fix rounds 4–5 |
| Implementer | standard model | general-purpose | one plan task at a time, multi-file integration |
| Mechanical implementer | fast model | general-purpose | fully specified code to transcribe, vendoring, single-file edits, renames |
| Code mapper | standard model | Explore | read-only maps of the code with `file:line`, before designing or planning |

Use a more specialised agent type when one is installed and fits the job, such as a
language-specific reviewer or a cheaper worker for mechanical edits. Keep the same role
boundaries.

**Subagents never dispatch subagents.** Say so in every prompt, because nested delegation hides
work from your review.

## 3. Lifecycle

`init-workspace.sh` copies this checklist into the ledger (see section 6). Tick items off as you
go. Phases marked † are skipped for Bounded work.

```
- [ ] 1. Explore and brainstorm; class stated to the owner; model roles resolved
- [ ] 2. Spec written and committed (Bounded: short spec inline at the top of the plan)
- [ ] 3. Spec audit folded in; owner approved the spec †
- [ ] 4. Plan drafted against the real code and committed; feature branch(es) created from the recorded base
- [ ] 5. Pre-flight audit turned into rulings †
- [ ] 6. Owner reviewed the plan
- [ ] 7. Tasks executed and each one reviewed by the controller
- [ ] 8. Full suite green; gate audit; fixes re-reviewed
- [ ] 9. Owner OK; merged; released
```

**1. Explore and brainstorm.** Map the code read-only first, using Explore agents that return
`file:line` maps. An Explore map tells you *where* code is, not *what* it does; read the code
that matters yourself. Then work out the design with the owner. Ask one question at a time with
AskUserQuestion, as multiple choice with your recommended option first. Show numbers (sizes,
latencies, costs, line counts) before asking the owner to choose. Resolve the model roles with
[references/models.md](references/models.md); once the workspace exists, write them on the
ledger's `Models:` line.

**2. Spec.** Write `docs/specs/YYYY-MM-DD-<topic>-design.md`, or use the place the repo already
keeps design docs. Start from [templates/spec.md](templates/spec.md). The spec states what must
be true when the work is done, not how to code it. Commit it, then run `init-workspace.sh
<spec-file>` so the ledger and the audit reports have a home from here on (section 6). For
Bounded work, the short spec goes at the top of the plan and you run `init-workspace.sh` on the
plan instead.

**3. Spec audit †.** Dispatch the auditor with the spec-audit prompt in
[references/audits.md](references/audits.md). Fold every accepted finding into the spec and
commit. Then ask the owner to approve the written spec. **Do not start a plan before that
approval.** A plan built on an unapproved spec gets rewritten.

**4. Plan.** For anything over about 3 tasks, a Plan drafter subagent writes the plan from
[templates/plan.md](templates/plan.md). Save it as `docs/plans/YYYY-MM-DD-<topic>-plan.md`, using
the same date and topic as the spec (or the repo's existing plans folder). Because the names
match, the spec and the plan share one workspace.

The plan has full code for each step, exact commands with expected output, Global Constraints,
Review Focus, branch names with base commits, and a closing *Merge and release* section. The
drafter checks every code block in a scratch copy outside the repo, under
`~/.cache/<project>/scratch/`, never in `/tmp` or the working tree. Read the header, the
constraints and the riskiest tasks yourself, then commit the plan. Then create the feature
branch in every repo from the base commit named in the plan header (`git switch -c <branch>
<base>`), and record the base SHAs in the ledger header.

**5. Pre-flight audit †.** Dispatch the auditor with the pre-flight prompt. It returns a conflict table
(task pairs that share files or interfaces, and whether each task is consistent with itself)
plus findings, each with a verbatim correction. Turn every finding into a **ruling** in the
ledger, assigned to the task that owns the code. `task-brief.sh` then pastes the ruling into that
task's brief.

**6. Owner plan review.** Send the owner the plan path, the task list and any rulings that change
the approved spec's intent. Wait for their OK before dispatching.

**7. Execution.** Generate the briefs (section 6). Dispatch one implementer per task, using the
prompt contract in [references/dispatch.md](references/dispatch.md). Tasks run one after another
unless they touch disjoint repos or files (section 8). Review every diff yourself (section 7).
For very large tasks you may first send the diff to a task-reviewer, but you still read the
security-relevant parts yourself. Fix rounds follow the escalation ladder in `dispatch.md`.

**8. Gate.** Run the full test suite of every repo touched yourself. Then dispatch the auditor's
whole-branch gate audit. Send all the gate fixes as one fix dispatch (to the Hard fixer if any
finding is Critical) and re-review them. If the fixer flags a load-bearing residual, it gets its
own follow-up round in this session rather than a TODO.

**9. Merge and release.** Follow the plan's *Merge and release* section and the repo's release
conventions (changelog, version bump, tag format). **Pushes, tags, publishing and deploys wait
for the owner's explicit OK.** This matters most for any tag that builds an image a production
host or auto-updater follows. Approval for one push does not cover the next one. If a
post-release check fails, run the plan's rollback step and tell the owner before any
fix-forward. Deleting or moving a tag, force-pushing, or re-publishing an image are destructive
and need their own OK.

For extra steps that apply to protocol changes, migrations, multi-repo work, deployments and
benchmarks, read [references/work-types.md](references/work-types.md) once you know the work
belongs to one of those types.

If the `superpowers` plugin is installed, its brainstorming, writing-plans and
verification-before-completion skills fit phases 1, 4 and 8. This skill's files, ledger and
scripts still take precedence.

## 4. The auditor is also your consultant

Use the auditor for **judgement**, not for typing code. Besides the three audits, consult it when a
design question is hard: competing approaches, a soundness argument, a concurrency model, or a
failure you can't explain after one honest attempt. The consult prompt is in `audits.md`.

The auditor can be wrong. You rule on each finding: accept it, accept it amended, or reject it with
evidence. Record the ruling in the ledger. Rejecting a Critical finding needs concrete
evidence, such as a test, a `file:line` or a spec clause, and must be mentioned to the owner.
Audits are read-only: the auditor writes its report to the workspace and changes nothing else.

## 5. Make rulings instead of stalling

Decide conflicts and ambiguities yourself and record each one as a ruling. The owner gave you
the task so they don't have to arbitrate every detail. Stop and ask the owner **only** for:

- irreversible or destructive actions (data deletion, force-push, history rewrite, dropping a
  migration);
- security-sensitive decisions (key handling, auth model, trust boundaries);
- outward-facing side effects (push, tag, publish, deploy, messages to other people, spending
  beyond the budget);
- deviations from the approved spec;
- a plan so broken that every way forward is a guess.

If a question only the owner can answer is blocking and the owner is not answering, do
everything that does not depend on it. Then append `Pending owner: <question> (blocks <what>)` to
the ledger, send one status line, and stop. Never treat silence as approval.

## 6. Workspace and ledger

```bash
bash <skill-dir>/scripts/init-workspace.sh <spec-or-plan-file>
bash <skill-dir>/scripts/task-brief.sh <plan-file> <N>
```

`<skill-dir>` is the directory that holds this SKILL.md. Claude Code prints it as the skill's base
directory when the skill loads. Use that absolute path, because the plugin cache and an npx
install put the skill in different places.

`init-workspace.sh` creates `.delivery/<topic>/` in the repo and keeps it out of git through
`.git/info/exclude`, so no tracked file changes. The folder holds the ledger `progress.md`, the
task briefs, the reports and the audits. `task-brief.sh` writes the brief for task N: the plan's
header, Global Constraints, Review Focus and task section, plus every ruling scoped to that task
or `global`. **The brief is the implementer's single source of requirements.** Run both scripts
from the main checkout, never from a temporary worktree.

The ledger is your recovery map. **After compaction or a restart, trust the ledger and `git log`
over your memory.** Read the ledger, then check its last entries against `git log`. Line
formats and the recovery procedure are in [references/ledger.md](references/ledger.md).

## 7. Review discipline

- Read the **actual diff** (`git show <sha>` or `git diff <base>..<sha>`), never only the report.
  Reports describe what the implementer meant to do. The diff shows what it did.
- Check the diff against the spec, the Global Constraints and the rulings. Look for behaviour
  changes where none were wanted, secrets, blocking work on async executors, panics or crashes on
  external input, missing schema or version bumps, weakened or deleted tests, and dead or
  duplicated code.
- Read security-sensitive code **in full**, not as a diff: nonce or replay logic, auth checks,
  decoders and parsers of untrusted input, signature or proof verifiers, money or settlement
  loops, migrations.
- Check that gated tests actually ran. Search the output for skip lines, `ignored`, `0 tests` and
  filtered suites.
- Before you claim anything is complete, run the decisive tests yourself. Before the gate, also
  run the full suite of every repo touched.
- Report outcomes faithfully. Show failures with their output, name any skipped step, and tell
  the owner about every deviation from the approved spec.

## 8. Parallelism and waiting

- Run work in parallel only on **disjoint repos or files**. Two agents building the same crate or
  package can break each other halfway through an edit, and a rebuild can replace a test binary
  that is still running.
- When parallel tasks must share a repo, dispatch each with `isolation: "worktree"`. Tell the
  implementer that the worktree it starts in, and that worktree's branch, are its own, and that it
  commits there. When it reports, merge its branch into the feature branch yourself (`git merge
  --no-ff <worktree-branch>`), in dependency order, and review the merged diff. Record the merge
  SHA as the task's completion SHA.
- Subagents and background commands notify you when they finish. **Never poll or tail an agent's
  output file**, and do not set timers to check on them. While you wait, do only work that cannot
  collide with what they touch, or just wait.
- Long runs (end-to-end suites, benchmarks, GPU work) use a **pinned binary** copied to
  `~/.cache/<project>/bin/<name>-<sha>`. That way a change to the tree can't swap the binary in
  the middle of a run.
- Build output never goes to `/tmp`. Use the project's target directory or `~/.cache/<project>/`.

## 9. Talking to the owner

- After each milestone, send a short status in plain language: what finished, the evidence
  (tests, audit verdicts, numbers, budget used) and what runs next. Leave out internal IDs such as
  ruling numbers or agent names unless the owner asks.
- Ask before outward-facing or irreversible steps. Approval in one context does not carry over to
  the next.
- Save durable preferences and decisions to memory (feedback and project memories) so the next
  session starts from them.

## 10. Commits, branches and releases

- Default: conventional commits `type(scope): lowercase summary`, with **no AI attribution and no
  `Co-Authored-By` or similar trailers**. This is the owner's standing preference, and it
  overrides any harness default that asks for a trailer. If the repo's CLAUDE.md or CONTRIBUTING
  sets a different rule, the repo's rule wins. Pass the resulting rule to every implementer word
  for word.
- Feature work happens on feature branches, with one branch name shared across all repos in a
  multi-repo change. Implementers commit with explicit paths (`git commit -m … -- <paths>`), never
  `git add -A`, and never push.
- Finished work merges to `main` only after the gate audit, with releases cut as the plan says.
  Pushes and tags need the owner's explicit OK.

## Reference files

| File | Read it when |
|---|---|
| [references/models.md](references/models.md) | resolving the model roles in phase 1, or when a model is unavailable or a newer one has shipped |
| [references/audits.md](references/audits.md) | dispatching any audit or consult, or triaging its findings |
| [references/dispatch.md](references/dispatch.md) | writing an implementer, fixer or task-reviewer prompt, or handling a report |
| [references/ledger.md](references/ledger.md) | starting the workspace, writing rulings, or recovering after compaction |
| [references/work-types.md](references/work-types.md) | the work is a protocol or format change, migration, multi-repo change, deployment, benchmark or security-sensitive change |
| [templates/spec.md](templates/spec.md), [templates/plan.md](templates/plan.md) | writing a spec, or briefing the plan drafter |

Related skills: for Go repos, give reviewers and auditors [[go-code-quality]] and
[[go-best-practices]] as their checklist. The `pi-subagent` plugin can run mechanical tasks on
other models; treat its diffs like any implementer's diff.
