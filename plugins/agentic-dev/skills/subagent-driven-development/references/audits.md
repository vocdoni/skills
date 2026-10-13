# Audits and consults

## Contents
- Ground rules for every audit dispatch
- Finding format and severity scale
- A. Spec audit
- B. Plan pre-flight audit
- C. Gate audit (whole branch)
- D. Consult on a hard question
- Triaging findings

## Ground rules for every audit dispatch

- `model`: the auditor model from the ledger's `Models:` line ([models.md](models.md)), agent type
  `general-purpose`. The result arrives as a notification. While it runs, touch nothing under
  audit.
- If the auditor model is unavailable, pick a substitute as [models.md](models.md) describes, send
  it the same prompt and record `Audit <kind>: run on <model> (auditor model unavailable)` in the
  ledger. Update the `Models:` line as [models.md](models.md) says.
- Give the auditor **paths, not pastes**. It reads the spec, plan, code and diffs itself, so it audits
  what is really there and not your summary of it.
- Say what is already decided and must not be relitigated, such as owner rulings and approved
  spec sections. Otherwise the audit spends its effort on settled questions.
- Audits are **read-only**. The auditor writes its report to the workspace path you give it and changes
  no other file, makes no commits and runs nothing that alters state. Read-only commands
  (`git log`, `grep`, running existing tests) are fine.
- The auditor does not dispatch subagents.
- An owner decision is not re-argued. But if following it produces a Critical defect, the
  auditor reports that as a finding titled `Escalation:` with the evidence. You carry it to the owner
  word for word, and you do not implement around it.
- The reply is short: the verdict, counts by severity and the report path. The full content goes
  in the file, so your context stays small.

## Finding format and severity scale

Use the same scale everywhere so rulings and briefs can cite findings unambiguously:

- **Critical**: wrong behaviour, data loss, a security hole, a broken build or protocol, or a
  plan that cannot be executed as written. Blocks the next phase.
- **Important**: a real defect or gap that will cost rework or confuse implementers. Fix it
  before the next phase unless you rule otherwise.
- **Minor**: clarity, naming or a small inefficiency. Fix it if cheap.

Older reports may say *Blocker*; read it as Critical.

Each finding in the report uses this block:

```
### F<n> [Critical|Important|Minor] <one-line title>
Where: <doc §section | file:line | Task N step M>
Problem: <what is wrong, stated as fact>
Evidence: <quote, file:line, command output — enough to verify without re-deriving>
Change: <exact replacement text or code, verbatim, ready to paste>
```

## A. Spec audit

```
You are a strict, independent auditor of a design spec. You did not write it and owe it no
loyalty. Your job is to find what will go wrong if we implement it as written.

Spec: <path>
Repos and code it concerns: <paths>
Already decided by the owner (do not relitigate): <list or "none">

Check:
1. Every claim about existing code is true. Open the files and cite file:line.
2. The goals and non-goals are unambiguous, and every goal has an acceptance criterion that a
   test or command could check.
3. Interfaces, data formats, versioning and compatibility are fully specified: old↔new readers
   and writers, rollout order, rollback.
4. Failure modes: untrusted input, partial failure, concurrency, restarts, resource limits.
5. Security: secrets, auth, trust boundaries, replay, injection.
6. Anything simpler that meets the same goals.
7. Missing decisions an implementer would have to guess.

Write the report to <workspace>/audit-spec.md:
- Verdict: APPROVE | APPROVE WITH CHANGES | REWORK
- Findings using the F<n> block format, most severe first
- "Verified" list: claims you checked and found correct (brief)

Read-only: change no file other than the report, and do not dispatch subagents.
Reply in under 8 lines: verdict, counts by severity, report path.
```

## B. Plan pre-flight audit

```
You are a strict pre-flight auditor of an implementation plan, run before any code is written.
Assume implementers will follow the plan literally and cannot see this conversation.

Plan: <path>
Approved spec: <path>
Repos: <paths> (base commit <sha> for each)

Produce:
1. Conflict table: every pair of tasks that touch the same file, symbol, interface, migration
   or config key. Columns: Task A | Task B | Shared thing | Conflict? | Required order or fix.
2. Self-consistency of each task: its code compiles against the code as it will exist when the
   task starts (after the earlier tasks), names and signatures match between tasks, the commands
   and expected output are plausible, and its tests really exercise the change.
3. Spec coverage: every spec requirement maps to a task and test, and no task does work the spec
   doesn't ask for.
4. Global Constraints: each one is either respected by every task or the plan says why not.
5. Merge and release section: complete, in the right order, and with owner OK points marked.

Write the report to <workspace>/preflight.md:
- Verdict: EXECUTE | EXECUTE AFTER FIXES | REPLAN
- The conflict table
- Findings using the F<n> block format. Put the owning task in "Where" and give verbatim
  corrections in "Change".

Read-only: change no file other than the report, and do not dispatch subagents.
Reply in under 8 lines: verdict, counts by severity, report path.
```

## C. Gate audit (whole branch)

```
You are the final, strict auditor before merge. Treat this branch as if it is about to run in
production, and look for reasons it should not merge.

Spec: <path>   Plan: <path>   Ledger: <workspace>/progress.md
Branches and diffs: <repo>: git diff <base>...<branch>   (one line per repo)
Known accepted deviations (rulings): <list or "see ledger">
Test evidence from the controller: <commands run and result lines>

Check:
1. Conformance: the branch does what the spec says, all of it and nothing more. Follow each
   acceptance criterion to the code and the test that proves it.
2. Correctness on the risky paths named in the plan's Review Focus. Read them in full, not as
   diffs.
3. Global Constraints and repo conventions: secrets, logging of sensitive data, error handling
   on external input, blocking work on async executors, version or schema bumps, commit hygiene.
4. Tests: they test behaviour rather than implementation, the gated ones really ran, and no test
   was weakened to pass.
5. Cross-repo consistency: shared types and formats, and dependency pins pointing at the right
   commits.
6. Leftovers: TODOs, debug code, dead code, untracked generated files.

Write the report to <workspace>/gate.md:
- Verdict: MERGE | MERGE AFTER FIXES | DO NOT MERGE
- Findings using the F<n> block format
- A "Residual risk" paragraph: what could still go wrong after the fixes, and how we would notice

Read-only: change no file other than the report, and do not dispatch subagents.
Reply in under 8 lines: verdict, counts by severity, report path.
```

## D. Consult on a hard question

```
I need a second opinion from an expert on a hard engineering question. Be direct, and disagree
with me if I'm wrong.

Context: <2–6 lines: system, constraint, what's at stake>
Relevant code and docs: <paths with file:line>
Question: <one precise question>
Options I see: <A, B, C, each with one line on its trade-off>
What I have already tried or ruled out: <...>

Answer with: your recommendation, the reasoning that decides it, the strongest argument against
it, and what evidence would change your mind. If the question is wrongly framed, say so and
reframe it. Write a full answer longer than 40 lines to <workspace>/consult-<topic>.md and reply
with a summary.
Read-only, and do not dispatch subagents.
```

## Triaging findings

After every audit, read the report in full, then record **one ruling per finding** in the ledger,
one line each:

`Ruling R<n> (Task N | Task N, Task M | global) [<audit> F<m>]: <decision>. Why: <reason>. Cost if wrong: <consequence>.`

- **Accept**: apply the Change as written. For spec and plan audits, edit the document and
  commit. For pre-flight findings, assign the ruling to the task that owns the code, so
  `task-brief.sh` puts it in that task's brief. If that task is already running, also send it
  the ruling with SendMessage.
- **Amend**: accept the problem but use a different fix. Say why.
- **Reject**: give concrete evidence (test, file:line, spec clause). If you reject a Critical
  finding, tell the owner.

Run another audit round only if the fixes were large or a Critical finding changed the design.
Otherwise go on to the next phase. Endless audit loops are a failure mode too.
