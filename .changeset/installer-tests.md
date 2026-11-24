---
"@vocdoni/skills": patch
---

`bin/install.js` now exports its helpers for tests and only runs the CLI when executed directly, reads CRLF SKILL.md frontmatter, and no longer scans a plugin's subdirectories for skills when its root has no SKILL.md. New `node:test` suite (`npm test`) and PR CI cover the installer and the pi-subagent server.
