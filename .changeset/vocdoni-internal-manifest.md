---
"@vocdoni/skills": minor
---

New `manifests/vocdoni-internal.toml`, the Vocdoni team's claudio plugin manifest (format 1): claudio v0.7.0 fetches it from claude.vocdoni.net and installs the 17 plugins it lists (every plugin of this marketplace plus firecrawl, context7, remember, cloudflare, railway, playwright and folio), configures the vocdoni-kb, jina and hackmd MCP servers, defines the worker, fast-worker, reviewer, planner-verifier, web-scout, academic-scout and ui-tester subagents, and injects the team instructions (light path versus agentic-dev delivery path, how to use the subagents).
