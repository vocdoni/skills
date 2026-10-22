---
"@vocdoni/skills": minor
---

The agentic-dev subagent-driven-development skill now keeps the plan drafter's validated code as per-task patches. The drafter commits once per task in a scratch git checkout of the base commit and exports each commit as `.delivery/<topic>/patches/task-<N>.patch`. Implementers apply patches with `git am -3` before adapting, so the drafter's validated code reaches production without re-transcription.
