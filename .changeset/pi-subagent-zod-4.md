---
"@vocdoni/skills": patch
---

pi-subagent 0.2.2 bundles zod 4 (fixing a memory-exhaustion advisory that has no zod 3 patch) and fast-uri 3.1.9 in its server. Tool-input validation is unchanged apart from the wording of its error messages. Dev and transitive dependencies vitest, body-parser, ip-address and @hono/node-server are also updated; none of them is part of the bundled server.
