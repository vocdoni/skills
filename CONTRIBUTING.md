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

- **Claude Code marketplace.** Users install from this repo's `main` branch. An installed plugin updates only when its `version` changes, so bump the plugin you changed in its `plugins/<plugin>/.claude-plugin/plugin.json` **and** in its `.claude-plugin/marketplace.json` entry, in the same PR. Merging to `main` is the release. These bumps are manual; Changesets never touches plugins.
- **npm (`npx @vocdoni/skills`).** The package bundles every local plugin, the CLI and the README. It is versioned with [Changesets](https://github.com/changesets/changesets).

### Adding a changeset

Any PR that changes what ships in the npm package (`bin/`, `plugins/`, `.claude-plugin/marketplace.json`, `README.md`) adds a changeset:

```sh
npx changeset
```

Select `@vocdoni/skills`, pick `minor` for a new skill or feature and `patch` for a fix, and write one sentence. That sentence becomes the CHANGELOG entry. Commit the generated `.changeset/*.md` with your PR.

### Publishing to npm

The [Release workflow](./.github/workflows/release.yml) runs on every push to `main`:

1. While changesets are pending, it opens or updates a release PR titled `chore(release): version @vocdoni/skills`. That PR bumps `version` in `package.json` and `package-lock.json` and writes `CHANGELOG.md`.
2. Merge that PR. The workflow runs again with nothing pending, runs `npm run release` (checks the release, then `changeset publish`), and creates a GitHub release and the tag `v<version>`.

A version already on npm is skipped, so re-running the workflow is safe.

To publish a pre-release, run `npx changeset pre enter next` in a PR and merge it. Versions become `x.y.z-next.N` and go to the npm `next` dist-tag, so `npx @vocdoni/skills` keeps resolving to the latest stable. `npx changeset pre exit` returns to stable releases.

Before you open a PR, check the release locally:

```sh
node .github/scripts/check-release.mjs
npx changeset status   # exits 1 if shipped files changed without a changeset
```

### One-time npm setup

The workflow publishes with npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC), so there is no npm token in the repo. npm only lets you add a trusted publisher to a package that already exists, so the first version is published by hand, before the workflow is first merged to `main`:

1. A member of the `@vocdoni` npm org publishes `0.1.0` from a clean checkout of `main`: `npm publish --access public`.
2. On npmjs.com, open the package's **Settings → Trusted publishing**, choose **GitHub Actions** and enter organization `vocdoni`, repository `skills`, workflow filename `release.yml`. Allow it to publish with `npm publish`.
3. On GitHub, open **Settings → Actions → General** and enable **Allow GitHub Actions to create and approve pull requests**. Without it the release PR cannot be opened.
4. The next version ships when the first release PR is merged. A new trusted publisher must complete a publish within 2 days, or it has to be created again.
