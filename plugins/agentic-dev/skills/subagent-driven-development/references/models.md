# Model roles

## Contents
- The four model roles
- Resolving a role to a model
- Recording the mapping
- Keeping this file current

The rest of the skill names **model roles**, never models, so it outlives any one model release.
This file is the only place that maps a role to a concrete model. Resolve every role once, at the
start of a delivery (phase 1), write the result to the ledger's `Models:` line as soon as the
ledger exists, and dispatch from that line until the delivery ends. A fixed mapping keeps audits and reviews comparable, and it
survives context compaction.

## The four model roles

| Model role | What the model must be good at | Skill roles that use it | Default | Agent tool `model` |
|---|---|---|---|---|
| **auditor model** | The strongest reasoning available: holding a spec, a plan and a whole-branch diff in mind at once, finding what the author missed, arguing soundness, concurrency and security. Speed and cost matter least. | Auditor and consultant | Fable 5.1 | `fable` |
| **strong model** | Deep coding and reasoning at a moderate cost: long plans written against real code, subtle fixes, concurrency, cryptography, security paths. | Plan drafter, Hard fixer, implementers of security-sensitive tasks | Opus 5.5 | `opus` |
| **standard model** | Reliable multi-file implementation and code reading at a low cost, following a precise brief. | Implementer, Code mapper | Sonnet 5.5 | `sonnet` |
| **fast model** | Quick, cheap execution of fully specified edits: transcribing given code, renames, vendoring, single-file changes. | Mechanical implementer | Haiku 5.5 | `haiku` |

Capability order: auditor ≥ strong > standard > fast. The escalation ladder in
[dispatch.md](dispatch.md) climbs this order, and every step below must keep it. After resolving
all four roles, check the order: if a role ends up on a stronger model than the role above it,
move the upper role to that model. The auditor always ends on the most capable model you have.

The controller is the session's own model and is not resolved here.

## Resolving a role to a model

Work through these steps for each role and stop at the first one that gives an answer. If none
applies, the Default column is the answer: steps 2 and 3 only move a role to something newer or
stronger, and steps 4 and 5 only apply when the default cannot be used.

1. **The owner or the repo names a model.** An instruction from the owner, or a rule in the
   repo's CLAUDE.md or CONTRIBUTING, wins over everything below.
2. **A newer version of the default exists.** Use the newest version in the default's family
   (Fable 5.5 once it ships replaces Fable 5.1, Opus 6 replaces Opus 5.5). Family aliases such as
   `fable` or `opus` in Claude Code's Agent tool normally resolve to the newest version the
   harness offers, so prefer the alias to a pinned model ID. Where the harness only takes full
   IDs, pick the highest version in the family. Check the model list in your environment or
   system prompt: if it names a newer version than the defaults above, that version is the
   default now.
3. **A newer family supersedes the default.** If the provider documents a new model as the
   successor to the default, or as stronger in the same price band, use it for that role.
4. **The default is not available.** The family is missing from the Agent tool's `model` values,
   the dispatch fails with a model error, or the account has no access. Pick the available model
   whose strengths best match the role's column above, judged by capability, not by name or
   release date. Then:
   - **auditor model:** use the most capable model available. If that is the controller's own
     model, the audits still run, but they are less independent because the same model wrote
     and audits the work. Tell the owner once, and say so in the ledger.
   - **any other role:** never use a model weaker than the role below it. If no model fits, take
     the next role up (auditor for strong, strong for standard, standard for fast). That costs
     more but stays safe.
   - Two roles may resolve to the same model. Keep the role boundaries anyway: the auditor stays
     read-only and implementers keep their prompt contract.
   - **no per-subagent choice:** if the harness cannot set a model for each subagent, every
     subagent runs on the session's model. Write `Models: all=<session model> (no per-agent model
     selection)` and apply the auditor note above.
5. **Other providers and local models.** If the harness offers models from other providers or
   local runtimes, map them by the same characteristics. The `pi-subagent` plugin can run tasks
   on such models; treat them as candidates for the fast or standard role unless the owner says
   they are stronger.

Never pick an older version than the default to save money. If cost is the concern, use a
cheaper role for the task instead.

## Recording the mapping

Write the resolved mapping in the ledger header as soon as `init-workspace.sh` has created the
ledger (phase 2); until then, keep it in the status you send the owner. Use the value you will
pass as the Agent tool's `model`, plus the concrete version when you know it. Replace the whole
placeholder line the script writes, including its hint:

```
Models: auditor=fable (Fable 5.1)  strong=opus  standard=sonnet  fast=haiku
```

Always set the Agent tool's `model` from this line. If you leave it out, the subagent inherits
the session's model, which is usually the most expensive one.

If a role has to change mid-delivery (a model becomes unavailable, or the owner asks), log
`Model: <role> -> <value> (<reason>)` and update the `Models:` line. An audit that ran on a
substitute is logged as `Audit <kind>: run on <value> (auditor model unavailable)`.

## Keeping this file current

The Default column is a snapshot of the best models when this file was last edited. Step 2 means
a newer release is picked up without editing anything. When a new family replaces a default, or
the capability order of the defaults changes, update the table so the next reader starts from the
right place.
