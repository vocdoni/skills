---
name: go-code-quality
description: Use this skill for production-grade Go code review, refactor, or generation - the checklist-driven side of Go work. Enforces strong domain modeling (no primitive obsession, no stringly-typed enums), explicit error contracts (return vs panic, %w vs %v, sentinel/typed/predicate errors, handle-once), context-and-cancellation discipline, bounded goroutine lifetimes, consumer-side interfaces, table-driven tests with got/want, and input validation at boundaries. Load this when the task is "review this Go", "is this production-ready", "harden this API", "refactor this package", or when assessing concurrency, error handling, or API design. Companion deep reference loaded on demand from references/go-practices.md.
---

# Go code quality

Production-oriented Go standards. The shape is: this file is the entry point with workflow + non-negotiables; the deep checklist lives in `references/go-practices.md` and should be loaded when the task is non-trivial (review, refactor, API design, error/concurrency design, or any case where a detailed rule is needed).

Related skills (load alongside as needed):

- [[go-best-practices]] — Rob Pike's *Go Proverbs*. Reach for it when the question is philosophical/architectural ("is this idiomatic", "channels or mutex", "small vs large interface", "should I use Cgo/unsafe/reflect").
- [[go-modern]] — version-aware modern Go syntax. Reach for it when deciding *which* feature to use (`slices`/`maps`/`cmp`, `t.Context()`, `omitzero`, `b.Loop()`, `wg.Go()`, `errors.AsType`, etc.).

This skill is the one to reach for when the question is "is this code production-ready" or "review this PR".

## Operating workflow

1. **Classify the task.**
   - *Generate code* — design the API and the error contract first, then write code and tests.
   - *Review code* — surface correctness and maintainability risks before style.
   - *Refactor code* — preserve behavior, improve types/errors/boundaries, then simplify.
   - *Debug code* — explain the root cause, propose a minimal fix, mention quality improvements only when relevant.

2. **Apply this priority order.**
   1. Correctness, data integrity, security.
   2. API contracts, strong typing, error semantics.
   3. Context, cancellation, resource cleanup, goroutine lifetimes.
   4. Readability, package boundaries, testability.
   5. Performance — only when supported by evidence or obvious allocation/complexity issues.
   6. Formatting/style last; `gofmt` and `goimports` settle it.

3. **Be concrete.** No "make it idiomatic." State the rule, why it matters, and the exact change.

4. **Respect local convention.** If the repository has an established pattern, follow it unless it's unsafe or clearly broken. Do not invent project conventions that conflict with the surrounding code.

## Non-negotiables

These are the rules to apply by default. The reference file has rationale, examples, and edge cases for each.

- **Domain types, not primitives.** Model status, role, ID, network, mode, phase, or method as named types with typed constants. No `string`/`int`/`bool` parameters when the value has business meaning.
- **Typed enums.** `type Status string` + named constants + a `Valid()` method and parsing helpers, or an `iota` enum starting at one so zero means unset.
- **Return errors, don't panic** for validation, I/O, parsing, missing data, bad input, remote failures, or recoverable states.
- **Handle each error once.** Either return with context, convert to a domain error, or handle. Don't log *and* return the same error from intermediate layers.
- **Wrap with `%w` only when the underlying error is part of the contract** (callers will use `errors.Is`/`errors.As`). Use `%v` or map to a package error when the underlying implementation must remain private.
- **Error strings: lowercase, no trailing punctuation** (unless they begin with a proper noun or acronym).
- **`context.Context` is explicit and first.** Don't store contexts in structs. Don't pass `nil`.
- **Don't silently discard errors with `_`** unless a documented API makes the error impossible or irrelevant — and say so in code.
- **`any`/`interface{}` only at boundaries** (serialization, truly generic containers, reflection-based APIs). Not as an escape from modeling.
- **Bounded goroutine lifetimes.** Every goroutine has a stop condition, cancellation path, or wait mechanism (`WaitGroup`/`errgroup`). No fire-and-forget.
- **Interfaces at the consumer.** Return concrete types from constructors. Define interfaces in the package that *uses* them, small and behavior-shaped.
- **Tests report `got` and `want`,** include inputs, and use table-driven subtests when cases share logic.
- **Validate untrusted input at boundaries** (HTTP, CLI, DB, JSON, network) and convert to domain types before passing inward.
- **`crypto/rand`, never `math/rand`,** for tokens, keys, nonces, salts, or any security-sensitive identifier.

For everything else — receiver choice, options structs, nil-slice semantics, map/slice copy at trust boundaries, fuzz tests for parsers, the full review checklist, ready-to-reuse review comments — load `references/go-practices.md`.

## Output formats

### Review feedback

Group by severity. Use `file:line` when available; otherwise identify the function or snippet.

```markdown
## Must fix
- [file:line] Concrete issue. Why it matters. Suggested replacement.

## Should improve
- [file:line] Maintainability/API/testability issue. Suggested replacement.

## Nice to have
- [file:line] Minor idiom/style improvement.

## Good patterns already present
- Specific positive observations worth keeping.
```

### Generation

- Imports that compile.
- `gofmt`-compatible formatting.
- Small, cohesive packages and functions.
- `(T, error)` or `error` returns when failure is possible.
- Tests for public behavior and edge cases when requested or when the code is non-trivial.
- A brief note on important design choices: exported error contracts, domain types, concurrency, API boundaries.

### Refactor

- Preserve behavior unless the user asked to change it.
- Show the changed code or patch.
- Distinguish behavior-preserving from behavior-changing changes.
- Call out migration impact when exported names, sentinel errors, struct fields, or public interfaces change.

## Source basis

Curated from the official Go documentation, *Go Code Review Comments*, the Go blog's error-handling guidance, Google's Go Style guides, and the Uber Go Style Guide. The detailed source map is at the top of `references/go-practices.md`.
