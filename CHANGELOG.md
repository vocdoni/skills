# @vocdoni/skills

## 0.3.0

### Minor Changes

- [#46](https://github.com/vocdoni/skills/pull/46) [`bb4537e`](https://github.com/vocdoni/skills/commit/bb4537e070f4833baa5e00a4408737aa3fd5717e) Thanks [@elboletaire](https://github.com/elboletaire)! - New plugin `vocdoni-comments` (`npx @vocdoni/skills install --plugin comments`): its `comments` skill keeps code comments to 1-3 lines that carry the why, and trims existing ones, on a branch or across a whole project, without losing anything only the comment said.

### Patch Changes

- [#48](https://github.com/vocdoni/skills/pull/48) [`15777ee`](https://github.com/vocdoni/skills/commit/15777ee0899ec1d2137be2a7d9fe02b3f1465a60) Thanks [@elboletaire](https://github.com/elboletaire)! - pi-subagent 0.2.2 bundles zod 4 (fixing a memory-exhaustion advisory that has no zod 3 patch) and fast-uri 3.1.9 in its server. Tool inputs now cap `tools` at the seven built-in tools and `files` at 1000 entries. Under zod 4, validation error messages are reworded, integer inputs above 2^53-1 are rejected, and the advertised tool schemas no longer claim `additionalProperties: false`, which was never enforced since unknown keys are still stripped. Dev and transitive dependencies vitest, body-parser, ip-address, qs and @hono/node-server (1.x to 2.x) are also updated; none of them is part of the bundled server.

## 0.2.0

### Minor Changes

- [#36](https://github.com/vocdoni/skills/pull/36) [`cc670d3`](https://github.com/vocdoni/skills/commit/cc670d3447a9d73e112c66b1ac20a88b81a3d8c3) Thanks [@altergui](https://github.com/altergui)! - The agentic-dev subagent-driven-development skill now keeps the plan drafter's validated code as per-task patches. The drafter commits once per task in a scratch git checkout of the base commit and exports each commit as `.delivery/<topic>/patches/task-<N>.patch`. Implementers apply patches with `git am -3` before adapting, so the drafter's validated code reaches production without re-transcription.

- [#40](https://github.com/vocdoni/skills/pull/40) [`f4c35d4`](https://github.com/vocdoni/skills/commit/f4c35d4ba763e7a11e847064edbcdc150448e9cb) Thanks [@p4u](https://github.com/p4u)! - New plugin `vocdoni-ui-style` (`npx @vocdoni/skills install --plugin ui-style`): builds UIs with Vocdoni's look and feel in its two visual modes, editorial (vocdoni.io) and product (vocdoni-app, with white-label support). It ships design tokens for Tailwind v4 + shadcn/ui, Chakra UI v3 and plain CSS, React components, logos, reference screenshots, runnable HTML examples, worked React recipes, step-by-step UX flows for voting and vote building, copy rules, and a brand style checker.

### Patch Changes

- [#39](https://github.com/vocdoni/skills/pull/39) [`1443132`](https://github.com/vocdoni/skills/commit/1443132c7ac9dfb2209d3fc9e7183fda3edbfb1e) Thanks [@p4u](https://github.com/p4u)! - pi-subagent 0.2.1 bundles MCP SDK 1.32 in its server: task lookups and task message queues are scoped to the session that owns them, and tool inputs get an element-count limit. Dependencies hono (security fixes) and vite are also updated; neither is part of the bundled server.

## 0.1.1

### Patch Changes

- [#32](https://github.com/vocdoni/skills/pull/32) [`929f4df`](https://github.com/vocdoni/skills/commit/929f4df64b3ff57aac711e68f842313484f2c2b4) Thanks [@elboletaire](https://github.com/elboletaire)! - Release automation now runs on Changesets: PRs that change what ships add a changeset, and a version PR publishes to npm with a changelog. No shipped files change in this release.
