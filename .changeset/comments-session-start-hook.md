---
"@vocdoni/skills": patch
---

vocdoni-comments 0.2.0 adds a SessionStart hook that injects the comment-writing rules into every Claude Code session, so they apply when comments are written as one step of a coding task. The README now says that plugins enabled through a repo's `.claude/settings.json` still have to be installed by each contributor. vocdoni-contributing 0.5.0 declares vocdoni-comments as a dependency, so Claude Code installs both together.
