---
"@vocdoni/skills": patch
---

pi-subagent 0.2.1 bundles MCP SDK 1.32 in its server: task lookups and task message queues are scoped to the session that owns them, and tool inputs get an element-count limit. Dependencies hono (security fixes) and vite are also updated; neither is part of the bundled server.
