---
"@vocdoni/skills": patch
---

`vocdoni-contributing` 0.3.0: the `contributing` skill now covers epics that take several PRs. The agent stacks them, each PR targeting the one before it, and manages the stack with `gh stack`, so a fully reviewed stack is merged in one operation instead of squashing each PR and rebasing the rest.
