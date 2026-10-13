# <Topic>: implementation plan

<!-- Save as docs/plans/YYYY-MM-DD-<topic>-plan.md, same date and topic as the spec. -->
<!-- task-brief.sh copies everything above the first "## " heading into every brief. -->
Spec: <path to approved spec, or "inline below" for Bounded work>
Class: bounded | architectural
Repos and branches: <repo path> → <branch> (base <sha>)   (one line per repo)

<!-- Bounded work only: put a short spec here (problem, goals, non-goals, acceptance criteria). -->

## Global Constraints
<!-- task-brief.sh copies this section into every brief. Keep it self-contained. -->
- Commit convention: conventional commits, no AI attribution or Co-Authored-By trailers <or the repo's rule, verbatim>
- Never push; commit with explicit paths only.
- Build output under <target dir or ~/.cache/<project>/>, never /tmp.
- <project constraints: resources, network, runtime rules, toolchain, secrets>
- <behaviour that must stay unchanged>

## Review Focus
<!-- task-brief.sh copies this section into every brief. The controller and the gate audit read these paths in full. -->
- <risky path or invariant, with file:line>

## Task order and parallelism
| Task | Depends on | Repo/files | May run in parallel with |
|---|---|---|---|

## Tasks

### Task 1: <title>
Model: fast | standard | strong   Repo: <path>   Files: <exact paths>
Goal: <one sentence, which acceptance criterion it serves>

Step 1: write the failing test
```<lang>
<full test code>
```
Run: `<exact command>`
Expected: `<the failure line>`

Step 2: implement
```<lang>
<full code, or an exact diff>
```
Run: `<exact command>`
Expected: `<the pass line with counts>`

Step 3: commit
`git commit -m "<type(scope): summary>" -- <paths>`

Interfaces this task provides to later tasks: <names and signatures>

### Task 2: <title>
...

## Merge and release
<!-- Not copied into briefs; the controller executes this after the gate audit. -->
1. Full suites: `<command per repo>` → expected `<counts>`
2. Merge order: <repo/branch → main, in dependency order>
3. Release: <version bump, changelog, tag format>
4. **Owner OK required before:** <push, tag, publish, deploy steps, listed individually>
5. Post-release checks: <health checks, smoke tests>
