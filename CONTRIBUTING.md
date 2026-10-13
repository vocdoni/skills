# Contributing

This repository is a **Claude Code marketplace** containing one or more **plugins**, each containing one or more **skills**. Three layers of nesting, three things to know how to add.

A **skill** is a small, focused, evergreen piece of guidance that an AI coding assistant should load when a particular kind of task comes up. It is *not* documentation, *not* a tutorial, and *not* a rules dump. The model decides whether to load it based on the `description` alone.

A **plugin** is a Claude Code-installable bundle of related skills (and optionally commands, agents, hooks). One plugin per language or topic — `vocdoni-go`, eventually `vocdoni-typescript`, `vocdoni-solidity`.

If you're not sure your idea is skill-shaped, ask yourself:

- Does it apply to a recurring class of tasks, not a single project?
- Would I want the model to follow it without being asked every time?
- Does it have a clear trigger (a kind of code, a kind of question)?

If yes to all three, write a skill. If no, it's probably a CLAUDE.md note or internal docs.

## Adding a skill to an existing plugin

One directory per skill under the plugin's `skills/`:

```
plugins/vocdoni-go/skills/
└── my-skill/
    ├── SKILL.md           # required
    ├── references/        # optional; loaded on demand
    │   └── deep-dive.md
    ├── examples/          # optional
    │   └── good.go
    └── scripts/           # optional; runnable helpers
        └── check.sh
```

The directory name **must** match `name:` in the frontmatter (kebab-case, ASCII, ≤64 chars).

## Adding a new plugin

```
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json        # required; see plugins/vocdoni-go/.claude-plugin/plugin.json
└── skills/
    └── <first-skill>/SKILL.md
```

Then register it in `.claude-plugin/marketplace.json`:

```json
{
  "name": "vocdoni-typescript",
  "source": "./plugins/vocdoni-typescript",
  "description": "…",
  "version": "0.1.0",
  "category": "engineering",
  "tags": ["typescript", "…"],
  "license": "AGPL-3.0-or-later",
  "homepage": "https://github.com/vocdoni/skills"
}
```

The plugin name should be `vocdoni-<topic>` so users can install with the short form `--plugin <topic>` from the npx CLI.

## SKILL.md frontmatter

```markdown
---
name: my-skill
description: Use this skill when … (third person, ≤1024 chars). Mention the kinds of tasks, the trigger phrases, and the technologies involved so the model can match it.
---
```

Required keys:

| Key           | Rules                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `name`        | kebab-case, ASCII, ≤64 chars, must match the directory name.                                           |
| `description` | One paragraph, ≤1024 chars, third person, explains *what* and *when*. This is the model's only signal. |

Optional keys we use:

| Key                 | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `allowed-tools`     | Restrict tools (e.g. `Read, Bash`) when the skill loads.                 |
| `disable-model-invocation` | Skill must be invoked explicitly; the model won't auto-load it.   |

## Writing the `description`

The model picks skills by reading descriptions. Make it count.

**Good:** concrete triggers, technologies named, kinds of tasks listed.

> Use this skill when writing, reviewing, or refactoring Go code, especially during design decisions involving concurrency, interfaces, error handling, or whether to use Cgo/unsafe/reflection.

**Bad:** vague, generic, no triggers.

> Best practices for writing good Go code.

## Body style

- Lead with the rule, then *why*, then *how*. The model is reading for guidance, not narrative.
- Show code. A short idiomatic example beats a paragraph of prose.
- Don't lecture. If something is obvious, cut it.
- Cross-link related skills with `[[skill-name]]` — link liberally, even to skills that don't exist yet (that signals what's worth writing next).
- No emojis. No marketing copy.
- Don't repeat the description in the body.

## Naming

Skill names are part of the public interface. Keep them short, specific, and tech-prefixed where useful:

- `go-modern`, `go-best-practices`, `go-testing`
- `react-hooks`, `tailwind-conventions`
- `vocdoni-monorepo` (project-specific)

Avoid: `general-advice`, `helpful-tips`, `coding`.

## Review checklist

Before opening a PR:

- [ ] `name:` matches the directory name.
- [ ] `description` says *what* and *when*, in third person, ≤1024 chars.
- [ ] The skill applies to a recurring class of tasks.
- [ ] Code samples compile / would lint cleanly.
- [ ] No marketing language, no emojis, no AI-tell phrasing (see [humanizer](https://github.com/anthropics/skills) signals).
- [ ] Cross-links to related skills use `[[name]]` form.
- [ ] `node bin/install.js list` shows the skill under its plugin and the truncated description reads cleanly.

## Testing locally

From the repo root:

```sh
# List all plugins and their skills with descriptions
node bin/install.js list

# Install everything into a throwaway directory
node bin/install.js install --dest /tmp/skills-test
ls /tmp/skills-test

# Install one plugin
node bin/install.js install --plugin go --dest /tmp/skills-test --force

# Install one skill, as a symlink into your real Claude Code config (live updates)
node bin/install.js install my-skill --symlink --force
```

Restart your Claude Code session to pick up changes when not using `--symlink`.

## Releasing

There are two channels, and they update differently:

- **Claude Code marketplace.** Users install from this repo's `main` branch. An installed plugin updates only when its `version` changes, so bump the plugin you changed in its `plugins/<plugin>/.claude-plugin/plugin.json` **and** in its `.claude-plugin/marketplace.json` entry, in the same PR. Merging to `main` is the release; users get it on their next `claude plugin marketplace update` (or automatically, if they enabled auto-update).
- **npm (`npx @vocdoni/skills`).** The package bundles every local plugin and the CLI, so it needs its own release whenever you want npx users to get changes.

To publish to npm:

1. In a PR, bump `version` in `package.json` (plus any plugin versions, as above), then merge it to `main`.
2. Create a GitHub release on `main` tagged `v<package.json version>`:

   ```sh
   gh release create v0.2.0 --target main --generate-notes
   ```

   Mark it as a pre-release (`--prerelease`) to publish under the npm `next` dist-tag instead of `latest`.
3. The [Release workflow](./.github/workflows/release.yml) runs on the published release. It checks the tag against `package.json`, checks that each `plugin.json` agrees with its marketplace entry and that every `SKILL.md` has a valid name and description, then runs `npm publish`. A version already on npm is skipped, so re-running the workflow is safe.

Run the same checks locally before you release:

```sh
node .github/scripts/check-release.mjs v0.2.0
```

### One-time npm setup

The workflow publishes with npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC), so there is no npm token in the repo. npm only lets you add a trusted publisher to a package that already exists, so the very first version is published by hand:

1. A member of the `@vocdoni` npm org publishes the first version from a clean checkout of `main`: `npm publish --access public`.
2. On npmjs.com, open the package's **Settings → Trusted publishing**, choose **GitHub Actions** and enter organization `vocdoni`, repository `skills`, workflow filename `release.yml`. Allow it to publish with `npm publish`.
3. Publish the next version through a GitHub release. A new trusted publisher must complete a publish within 2 days, or it has to be created again.
