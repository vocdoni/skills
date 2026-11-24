---
"@vocdoni/skills": patch
---

`bin/install.js` now exports its helpers for tests and only runs the CLI when executed directly; the new `node:test` suite (`npm test`) and PR CI cover the installer and the pi-subagent server.
