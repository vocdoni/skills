---
"@vocdoni/skills": patch
---

`agentic-dev`: the SessionStart hook and the skill description now ask for the subagent-driven-development skill only for long work (many steps, several modules or repos, more than one session) or work touching a critical component (auth, secrets, payments, voting or ballot logic, cryptography, migrations, wire formats, deployments), plus the explicit triggers (spec, plan, audit, ledger, a `.delivery/` folder). Everything else, including multi-file changes in one module, takes the light path. This matches the Vocdoni team policy in the `vocdoni-internal` claudio manifest.
