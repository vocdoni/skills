---
"@vocdoni/skills": minor
---

New plugin `vocdoni-contributing` (`npx @vocdoni/skills install --plugin contributing`): its `contributing` skill sets the rules for what the agent posts on GitHub or GitLab (PR and MR descriptions, issues, reviews and commits), and its SessionStart hook injects the same rules into every Claude Code session by reading the skill's SKILL.md.
