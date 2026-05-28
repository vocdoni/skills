---
name: go-best-practices
description: Use this skill for architectural and idiomatic Go decisions - the philosophical side of Go work. Encodes Rob Pike's Go Proverbs ("share memory by communicating", "the bigger the interface the weaker the abstraction", "errors are values", "clear is better than clever", "Cgo is not Go", etc.) as concrete guidance with rationale and examples. Trigger on "is this idiomatic", "should I use a channel or a mutex", "small vs large interface", "should I use Cgo / unsafe / reflect", "is this the Go way", or whenever a design call hinges on Go philosophy rather than a concrete checklist. For production-readiness review and the rule-by-rule checklist (domain types, error contracts, context discipline, goroutine lifetimes), reach for go-code-quality instead.
---

# Go best practices

Rob Pike's *Go Proverbs* as concrete guidance. Use these as defaults when writing or reviewing Go. Deviation is fine when the situation justifies it, but the deviation should be deliberate.

## How to use this skill

This file is the index. The 19 proverbs each have rationale and idiomatic code examples in `references/proverbs.md`. Load the full reference when:

- A design decision hinges on which proverb applies (e.g. "is this case really one where I should use unsafe?").
- You're explaining *why* something is or isn't idiomatic and need the standard wording or example to ground the explanation.
- The user asks for the proverb in detail or quotes one.

For a quick sanity check or to refresh which proverb is relevant, the one-liners below are usually enough.

## The 19 proverbs

**Concurrency**

1. **Don't communicate by sharing memory; share memory by communicating** — Pass data via channels; ownership transfers, no races.
2. **Concurrency is not parallelism** — Concurrency is about structure (how a program is composed); parallelism is about execution (whether goroutines run simultaneously). One enables the other; neither requires it.
3. **Channels orchestrate; mutexes serialize** — Channels coordinate goroutines and lifecycles; mutexes protect simple shared state.

**Interfaces and types**

4. **The bigger the interface, the weaker the abstraction** — `io.Reader` is powerful because it has one method. Many-method interfaces force narrow implementations.
5. **Make the zero value useful** — Design types so `var x T` is already valid (`sync.Mutex`, `bytes.Buffer`, nil slices).
6. **`interface{}` says nothing** — The empty interface (or `any`) tells the reader and the compiler nothing. Keep it at serialization boundaries only.

**Style and tooling**

7. **`gofmt`'s style is no one's favorite, yet `gofmt` is everyone's favorite** — A standard format matters more than personal preferences. Run `gofmt`/`goimports` and move on.
8. **A little copying is better than a little dependency** — Don't pull a 50-function library to use one helper. Copy it, attribute it, move on. (Standard library is not what this is about.)

**Cgo, syscall, unsafe**

9. **Syscall must always be guarded with build tags** — If you import `syscall`, you should have a build tag. If you're writing portable code, use `os` instead.
10. **Cgo must always be guarded with build tags** — Platform-specific C is platform-specific Go. Make it explicit.
11. **Cgo is not Go** — You lose memory safety, easy deployment, fast compilation, cross-compilation. Use only when necessary.
12. **With the `unsafe` package, there are no guarantees** — `unsafe` opts out of Go's version-stability and memory-safety contracts. Isolate it, document why, accept the cost.

**Clarity and reflection**

13. **Clear is better than clever** — Code is read more often than written. Optimize for the reader.
14. **Reflection is never clear** — Runtime-only, hard to read, easy to get wrong. Prefer interfaces or generics. Library authors aside.

**Errors**

15. **Errors are values** — Errors are data you can program with: accumulators, joiners, collectors, wrappers. Not just `if err != nil { return err }`.
16. **Don't just check errors, handle them gracefully** — Decide: wrap, branch by kind, retry, fall back, log. The decision is part of the code's behavior.

**Design and docs**

17. **Design the architecture, name the components, document the details** — Names carry the design. Good names make code self-documenting; docs fill the gaps.
18. **Documentation is for users** — Godoc explains *how to use*, not *how it works*. Lead with purpose, include examples, mention edge cases.

**Panics**

19. **Don't panic** — Panic is for programmer errors and unrecoverable startup failures. Return errors for everything that can happen during normal operation.

## When the index isn't enough

Open `references/proverbs.md` and jump to the proverb by number or by title. Each entry has:

- **What it means** — the proverb stated plainly.
- **Why it matters** — the reasoning, so you can judge edge cases instead of applying the rule mechanically.
- **In practice** — idiomatic and counter-idiomatic code, side by side.

## See also

- [[go-code-quality]] — production checklist: domain types, error contracts, context discipline, bounded goroutines, review feedback format.
- [[go-modern]] — version-aware modern Go syntax (`slices`/`maps`/`cmp`, `t.Context()`, `omitzero`, `b.Loop()`, `wg.Go()`, `errors.AsType`, etc.).
- Rob Pike, *Go Proverbs* — <https://go-proverbs.github.io/>
- *Effective Go* — <https://go.dev/doc/effective_go>
- *Go Code Review Comments* — <https://go.dev/wiki/CodeReviewComments>
