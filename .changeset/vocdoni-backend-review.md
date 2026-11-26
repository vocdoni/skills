---
"@vocdoni/skills": minor
---

Adds the `vocdoni-backend-review` skill to `vocdoni-go` (0.2.0): an explicitly invoked, iterative review of a Vocdoni Go backend branch. Six independent subagent reviewers (usage, design, implementation, style, testing, documentation) review the full diff against a fixed base, a planner and an implementer fix the findings, and the loop repeats until all six report clean, within an iteration budget and with a ledger in `.delivery/`.
