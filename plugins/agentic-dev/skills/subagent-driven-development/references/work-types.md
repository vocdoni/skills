# Extra steps by type of work

Read only the section that matches the work. Each one adds requirements to the spec, the plan's
Global Constraints and the gate audit. It does not replace the lifecycle.

## Contents
- Protocol, wire-format and API changes
- Schema and data migrations
- Multi-repo changes
- Deployments and infrastructure
- Benchmarks and performance work
- Security-sensitive changes

## Protocol, wire-format and API changes

- The spec has a **compatibility matrix**: old writer → new reader and new writer → old reader,
  each marked supported, rejected cleanly, or not applicable. "Rejected cleanly" means a typed
  error, never a panic or a silent misread.
- Version the format explicitly (version field, magic, content type or API version) and bump it.
- Commit **golden vectors** (canonical encoded bytes or JSON) and test both directions against
  them. A golden file changes only in a commit that explains why.
- Decoders of untrusted input get length limits, bounds checks and fuzz or property tests where
  the stack supports them.
- The plan states the **rollout order** (readers before writers, or a dual-read window) and the
  rollback path.

## Schema and data migrations

- Prefer **expand → migrate → contract** across separate releases. Never drop or rename in the
  same release that stops using the old shape.
- Every migration has a tested down-migration, or the spec says explicitly that it is
  irreversible. Irreversible migrations need the owner's OK before they run anywhere shared.
- Test against a copy of realistic data volume and shape, and record the run time.
- The plan lists backup and restore steps before the migration runs in production.

## Multi-repo changes

- Use one branch name in every repo. The ledger header lists every repo with its base SHA.
- The plan orders the tasks by dependency (library before consumer) and says how consumers pin
  the new version: path or git dependency during development, a released version before merge.
- Repos are disjoint, so tasks in different repos may run in parallel. Tasks in the same repo
  may not, unless they use worktrees.
- The gate audit covers **all** repos together, including the pins pointing at the right commits.
- Merge and release in dependency order, and re-pin consumers to the released version before
  their own merge.

## Deployments and infrastructure

- Write the **rollback plan before** the deploy plan, and test it if you can.
- Dry run first (`plan`, `diff`, `--dry-run`, staging), and show the owner the diff.
- Every step that changes a shared or production system needs the owner's explicit OK at the
  time it happens. This includes publishing an image or tag that an auto-updater or production
  host follows.
- After deploying, watch health checks, logs and error rates for an agreed window, and report
  the numbers.
- Never print secrets or full credentialed URLs in commands, logs or reports.

## Benchmarks and performance work

- **Baseline first**: measure the unchanged code with the same harness, machine and inputs.
- Use a **pinned binary** for every measured variant (`~/.cache/<project>/bin/<name>-<sha>`), so
  a rebuild cannot change what is being measured.
- Run each variant several times (5 or more for noisy workloads). Report the median and spread,
  not one best run.
- Keep the machine quiet: no parallel builds or agents on it during a measured run. Write down
  anything that couldn't be controlled (thermal limits, shared GPU).
- A correctness gate runs before every measurement. A faster wrong answer is a failure.
- The report gives exact commands, the commit SHA, the hardware, and the numbers in a table
  against the baseline. Claim only what the numbers show.

## Security-sensitive changes

Covers auth, crypto, key handling, nonces or replay protection, sandboxing, and parsers of
untrusted input.

- The class is at least Architectural, whatever the size.
- Implementers on these tasks use the strong model ([models.md](models.md)). The controller reads
  the final code **in full**.
- The spec states the threat model in a few lines: who the attacker is, what they control, and
  what must hold.
- Tests include negative cases: replayed, malformed, oversized, expired or wrongly signed input.
- Ask the auditor directly in the gate audit to try to break the change.
