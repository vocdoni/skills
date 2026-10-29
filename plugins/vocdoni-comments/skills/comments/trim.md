# Trimming comments

Comments only: never change code. What a good comment says is in [SKILL.md](SKILL.md).

## 1. Scope

Two modes:
- **Branch** (the default, `/comments trim`): only the comments a branch added.
- **Project** (`/comments trim project [path]`, or a request to trim the whole project, a package or a folder): every comment in the tracked files under `path`, or the whole repo.

A **block** is a run of consecutive comment lines.

### Branch mode

1. **Base:** the fork point, `git merge-base <ref> HEAD`, where `<ref>` is the ref you were given, or else the remote default branch (`git fetch`, then `origin/HEAD`, else `origin/main` or `origin/master`). Read `git diff <base>...HEAD`, plus uncommitted changes if the tree is dirty.
2. **In scope** means one of:
   - the branch created the block, or
   - the block existed on the base and the branch made it longer. Compare with `git show <base>:<file>`.
3. **Out of scope:** everything else stays exactly as it is, however long. That includes blocks the branch only edited, shortened or left at the same length.

### Project mode

1. **Files:** `git ls-files` under the path, so ignored and untracked files stay out.
2. **In scope:** every block over 3 lines.
3. **Clean tree first:** if the tree is dirty, stop and ask. The result has to be reviewable as its own diff.

### Both modes skip

- generated files: bindings, `*.pb.go`, lockfiles, vendored code,
- docs: README, AGENTS.md/CLAUDE.md, skills, `docs/`,
- comments that aren't prose: licence and copyright headers, and directives (`//go:build`, `//nolint`, `// eslint-disable`, `# type: ignore`, shebangs), which tools or the licence read verbatim.

## 2. Trim each in-scope block over 3 lines

For every piece of information you'd drop, classify it:
- **(a) The code says it:** names, logic or types make it obvious. Drop it.
- **(b) It's documented elsewhere:** in the repo's docs or another comment in the same package. Search for it and note the file and line for the report. Drop it, or leave a short pointer.
  - The other place must survive this run: docs, or a comment you're keeping. If two in-scope comments say the same thing, don't drop it from both; keep it at the spot it concerns most.
  - Dropping a duplicate must not lose a detail only it had. That detail is (c) at its own spot: keep it there in its 1-3 lines, rather than merging it into the surviving comment, which would only make that one long.
  - A pointer names the file and identifier ("see `vote.go` `castBallot`"), never a line number, which goes stale.
- **(c) It's only here:** if it's a real constraint, a non-obvious why or a gotcha, it **must stay**.
  - Rework the comment so it fits in 3 lines and still carries it,
  - or move it to the line or field it concerns, still within 3 lines.

Then:
- **Always drop:** restated code, history and narration, measurements.
  - **History that carries a why** ("this used to deadlock when…, so we lock first") is (c): keep the why in present tense ("locking first avoids a deadlock when…") and drop the story.
- **Keep the core message:** the comment still answers what a reader would ask at that spot.
- **Check each claim against the code:** a trimmed comment must not be narrower or broader than what the code does. For example, "an unknown X is an error" is wrong when the code also lets a no-X case through.
- **Package overviews** (Go `doc.go`, module docstrings) work as docs, so the 3-line limit doesn't fit them. Trim them anyway: drop restated code, history, measurements and whatever the README already says, and keep the overview a reader needs to start in that package.
- **Look again:** check for in-scope blocks you missed that are still over 3 lines.

## 3. Who does it

- **Use judgement:** this needs judgement on every block, so do it yourself, or delegate to a subagent on the strongest model available. This overrides any rule that sends code changes to a small worker model.
- **Never a small model:** don't hand it to a small, fast model. It drops constraints that were only stated in the comment.
- **Small worker models** never trim, with or without a commit: list the blocks over 3 lines in your report, so the agent that delegated the change trims them.
- **Large diffs or project mode:** split the work by package or module across several such subagents, each with its own list of files.

## 4. Verify

- **Comments only:** the diff contains no code changes beyond what the formatter does.
- **Formatter:** gofmt, prettier or the project's equivalent is clean on the touched files.
- **Checks:** build, vet or lint, and tests pass for the touched modules.
- **Commit:** when the trim is the task itself, don't commit and leave the result for review. When it runs as SKILL.md's pre-commit check, go on with the commit you were making. When you trim a delegated change the worker already committed, commit the trim on that branch before merging it.

## 5. Report

- **One entry per in-scope block**, a table when there are more than a few. In project mode, group the table by package:
  - file:identifier,
  - in scope (created, grown from N to M lines, or N lines in project mode),
  - what was dropped,
  - where that lives: code / file:line / doc section, or "only here: kept".
- **Out of scope:** blocks the branch touched but didn't add or grow, and skipped files, go in a short list with the reason, not a row each.
- **Restored or reworked:** the blocks restored to their original text or reworked to keep a constraint.
- **Leftovers:** any in-scope block still over 3 lines. There should be none; if there is one, say why.
- **Stale docs:** docs that pointed at a shortened comment and now read wrong. List them; don't fix docs unasked.
- **Verification results.**
