---
"@vocdoni/skills": patch
---

pi-subagent 0.2.2 bundles zod 4 (fixing a memory-exhaustion advisory that has no zod 3 patch) and fast-uri 3.1.9 in its server. Tool inputs now cap `tools` at the seven built-in tools and `files` at 1000 entries. Under zod 4, validation error messages are reworded, integer inputs above 2^53-1 are rejected, and the advertised tool schemas no longer claim `additionalProperties: false`, which was never enforced since unknown keys are still stripped. Dev and transitive dependencies vitest, body-parser, ip-address, qs and @hono/node-server (1.x to 2.x) are also updated; none of them is part of the bundled server.
