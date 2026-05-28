# Rob Pike's Go Proverbs — full reference

Companion reference for the [[go-best-practices]] skill. Read this when the SKILL.md index doesn't give you enough — when you need the rationale and code examples behind one of the proverbs, or want to look up the exact wording.

The proverbs are short statements that capture how Go is meant to be used. Treat them as defaults. Deviating is fine when the situation calls for it, but the deviation should be deliberate, not accidental.

## 1. Don't communicate by sharing memory; share memory by communicating

**What it means:** Instead of using shared memory protected by locks, pass data between goroutines using channels.

**Why it matters:**

- When you send data over a channel, the ownership transfers.
- No simultaneous access means no race conditions.
- Concurrent code is easier to reason about.

**In practice:**

```go
// Less idiomatic: shared memory with mutex
var cache map[string]string
var mu sync.Mutex
func updateCache(key, value string) {
    mu.Lock()
    cache[key] = value
    mu.Unlock()
}

// More idiomatic: communicate via channels
type CacheUpdate struct {
    key   string
    value string
}
updates := make(chan CacheUpdate)
go func() {
    cache := make(map[string]string)
    for update := range updates {
        cache[update.key] = update.value
    }
}()
```

## 2. Concurrency is not parallelism

**What it means:** Concurrency is about structure; parallelism is about execution.

**The distinction:**

- **Concurrency:** a way of structuring a program so independent pieces can make progress.
- **Parallelism:** the simultaneous execution of multiple goroutines on multiple cores.

**Why it matters:**

- Concurrent programs run fine on a single core.
- Parallel execution requires multiple cores.
- Good concurrent design enables parallelism but doesn't require it.

**In practice:** design with concurrent components (goroutines, channels) that coordinate independently. Whether they actually run in parallel is a runtime decision the scheduler makes.

## 3. Channels orchestrate; mutexes serialize

**What it means:** Use channels for coordination and flow control; use mutexes for protecting state.

**When to use each:**

- **Channels for orchestration:** coordinating multiple goroutines, building pipelines, broadcasting signals, managing lifecycle.
- **Mutexes for serialization:** protecting shared state, fine-grained locking, simple/quick operations, caches.

**In practice:**

```go
// Mutex: protecting simple state
type Counter struct {
    mu    sync.Mutex
    count int
}
func (c *Counter) Increment() {
    c.mu.Lock()
    c.count++
    c.mu.Unlock()
}

// Channel: orchestrating work
func worker(jobs <-chan Job, results chan<- Result) {
    for job := range jobs {
        results <- process(job)
    }
}
```

## 4. The bigger the interface, the weaker the abstraction

**What it means:** Small interfaces are more powerful and more flexible than large ones.

**Why it matters:**

- Small interfaces are easier to implement.
- More implementations mean more reusability.
- Small interfaces force you to think about the *essential* behavior.

**The power of small interfaces:**

- `io.Reader` has one method — countless implementations.
- `io.Writer` has one method — countless implementations.
- The empty interface has zero methods — universally satisfied, but conveys no meaning.

**In practice:**

```go
// Weak abstraction: too many methods
type DataStore interface {
    Save(data Data) error
    Load(id string) (Data, error)
    Delete(id string) error
    List() ([]Data, error)
    Count() (int, error)
    Search(query string) ([]Data, error)
}

// Strong abstraction: focused interfaces
type Saver interface {
    Save(data Data) error
}
type Loader interface {
    Load(id string) (Data, error)
}

// Compose small interfaces as needed
type Repository interface {
    Saver
    Loader
}
```

## 5. Make the zero value useful

**What it means:** Design types so their zero value is ready to use without initialization.

**Why it matters:**

- Reduces API surface (fewer constructors needed).
- Makes composition simpler.
- Lets users write less boilerplate.

**Examples from the standard library:**

- `sync.Mutex` — ready to use as declared.
- `bytes.Buffer` — a valid empty buffer.
- Slices and maps (as zero values) — safe to read from.

```go
// Good: zero value is useful
type Logger struct {
    prefix string
    writer io.Writer // nil is ok, can be checked
}
func (l *Logger) Log(msg string) {
    if l.writer == nil {
        l.writer = os.Stderr
    }
    fmt.Fprintf(l.writer, "%s: %s\n", l.prefix, msg)
}

// Usage: no constructor needed for the basic case
var log Logger
log.Log("hello") // works immediately
```

## 6. `interface{}` says nothing

**What it means:** The empty interface carries no information about what it contains.

**Why it matters:**

- No compile-time type safety.
- Forces runtime type assertions.
- Makes code harder to understand and maintain.
- Effectively turns a section of Go into a dynamically typed language.

> Use `any` (Go 1.18+) as the spelling, but the warning is the same: it tells the reader nothing.

**Common misuse:**

```go
// Weak: loses all type information
func Process(data any) error {
    // Now what? Type assertion required.
    // No compile-time guarantees.
}

// Better: use a small interface with actual requirements
type Processor interface {
    Process() error
}

func Process(p Processor) error {
    return p.Process()
}
```

**When it's appropriate:**

- Truly generic containers (rare; usually generics are better).
- Reflection-based libraries (`encoding/json`, `fmt`).
- When you genuinely need to handle any type.

## 7. `gofmt`'s style is no one's favorite, yet `gofmt` is everyone's favorite

**What it means:** Having a standard format matters more than personal preferences.

**Why it matters:**

- Eliminates bikeshedding and style debates.
- Makes code reviews focus on logic, not formatting.
- Creates consistency across the entire ecosystem.

**In practice:**

- Configure your editor to run `gofmt` on save.
- Use `gofmt -w` to format files.
- Better yet, use `goimports`, which also manages imports.
- Add formatting checks to CI.

## 8. A little copying is better than a little dependency

**What it means:** Sometimes duplicating a small amount of code is better than adding a dependency.

**Why it matters:**

- Dependencies add complexity and maintenance burden.
- Larger dependency trees increase build times and supply-chain surface area.
- Small copies can be customized to the local context.

**Real example from the standard library:** the `strconv` package implements its own `isPrint` function instead of depending on the `unicode` package, saving ~150 KB of data tables. A test ensures they stay in sync.

**Guidelines:**

- Small, self-contained functions are good candidates for copying.
- Avoid depending on large libraries for trivial functionality.
- Document where the copied code came from.
- Consider the trade-off: maintenance vs. dependency weight.

**In practice:**

```go
// Instead of importing a full library for one utility:
// import "github.com/someone/utils" // 50+ functions, but you need 1

// Consider copying the small function you need:
func contains(slice []string, item string) bool {
    for _, s := range slice {
        if s == item {
            return true
        }
    }
    return false
}
```

> On Go 1.21+, prefer `slices.Contains` over rolling your own. The proverb is about *external* dependencies, not the standard library.

## 9. Syscall must always be guarded with build tags

**What it means:** System calls are platform-specific and must use build tags.

**Why it matters:**

- System calls are inherently non-portable.
- Different OSes expose different syscalls.
- Attempting to compile for the wrong platform will fail.
- Build tags make platform requirements explicit.

**In practice:**

```go
//go:build linux

package mypackage

import "syscall"

func platformSpecific() error {
    return syscall.Setuid(1000)
}
```

**The principle:** if you're importing the `syscall` package, you should have a build tag. If you think you're writing portable code with `syscall`, you're using the wrong package — use `os` or another portable abstraction instead.

## 10. Cgo must always be guarded with build tags

**What it means:** C interop is platform-specific and should use build tags.

**Why it matters:**

- C code behavior varies by platform.
- C libraries may not be available on all systems.
- Build tags make requirements explicit.
- Prevents mysterious build failures.

**In practice:**

```go
//go:build cgo && linux

package mypackage

/*
#include <stdio.h>
*/
import "C"
```

## 11. Cgo is not Go

**What it means:** Using Cgo sacrifices many of Go's benefits.

**What you lose with Cgo:**

- Memory safety.
- Easy deployment (you now need C libraries available at build/run time).
- Fast compilation.
- Simplicity and debuggability.
- Cross-compilation ease.

**When to use Cgo:**

- It is absolutely necessary to interface with an existing C library.
- Performance-critical code where C is genuinely required.
- No pure-Go alternative exists.

**When to avoid Cgo:**

- For convenience.
- Because you're more comfortable with C.
- To use a C library when a Go alternative exists.

> Rob Pike: "A program that uses Cgo is a C program."

## 12. With the `unsafe` package, there are no guarantees

**What it means:** Using `unsafe` bypasses Go's type and memory safety guarantees.

**Why it matters:**

- No guarantees about compatibility across Go versions.
- Code may break on runtime updates.
- Violates memory safety.
- Makes code non-portable.

**Common misuse:**

```go
// This might break in future Go versions
type StringHeader struct {
    Data uintptr
    Len  int
}

s := "hello"
header := (*StringHeader)(unsafe.Pointer(&s))
```

**When it's appropriate:**

- Very low-level system programming.
- Performance-critical code, after benchmarking proves the need.
- Interfacing with C or system calls.
- You accept that you're on your own.

**The contract:** if you use `unsafe`, you've opted out of stability guarantees.

## 13. Clear is better than clever

**What it means:** Optimize for readability and maintainability over cleverness.

**Why it matters:**

- Code is read far more often than it is written.
- Clever code is hard to debug.
- Teammates need to understand your code.

```go
// Clever but unclear
func f(x int) bool {
    return x&1 == 0 && x > 0 || x < 0 && x&1 == 1
}

// Clear and maintainable
func isOppositeSignAndParity(x int) bool {
    isEven := x%2 == 0
    isPositive := x > 0
    return (isEven && isPositive) || (!isEven && !isPositive)
}
```

**Guidelines:**

- Write for the reader, not the writer.
- Use clear names.
- Break complex expressions into named steps.
- Comment on the "why," not the "what."

## 14. Reflection is never clear

**What it means:** Code using the `reflect` package is inherently difficult to understand.

**Why it matters:**

- Only runtime checks, no compile-time safety.
- Hard to read and maintain.
- Easy to get wrong.
- Performance overhead.

**Who legitimately uses reflection:**

- Library authors (`encoding/json`, ORMs).
- Framework developers.
- Almost certainly not you, at least not yet.

**When you think you need reflection,** ask:

1. Can I use an interface instead?
2. Can I use generics (Go 1.18+)?
3. Can I use code generation?
4. Do I really need this flexibility?

Most beginners reaching for `reflect` are solving the wrong problem — they need better interface design or to accept some reasonable duplication.

## 15. Errors are values

**What it means:** Errors are just values you can program with, not a control-flow primitive.

**Why it matters:**

- Enables creative error-handling strategies.
- Errors can be wrapped, decorated, stored, or transformed.
- You're not limited to "return up the stack."

**Common mistake — pure pass-through:**

```go
if err != nil {
    return err
}
if err != nil {
    return err
}
if err != nil {
    return err
}
```

**Better — treat errors as data:**

```go
// Example 1: Error accumulator
type ErrorWriter struct {
    w   io.Writer
    err error
}

func (ew *ErrorWriter) Write(buf []byte) {
    if ew.err != nil {
        return
    }
    _, ew.err = ew.w.Write(buf)
}

// Multiple writes become clean
ew := &ErrorWriter{w: w}
ew.Write(p1)
ew.Write(p2)
ew.Write(p3)
if ew.err != nil {
    return ew.err
}

// Example 2: Error collector
var errs []error
for _, item := range items {
    if err := process(item); err != nil {
        errs = append(errs, fmt.Errorf("item %v: %w", item, err))
    }
}
if len(errs) > 0 {
    return errors.Join(errs...) // Go 1.20+
}
```

## 16. Don't just check errors, handle them gracefully

**What it means:** Consider what should happen when an error occurs; don't just return it.

**Why it matters:**

- Error handling is a critical part of your program's behavior.
- Users need meaningful error messages.
- Errors should provide context about what went wrong.

**Levels of error handling:**

**Level 1 — Just return (least context):**

```go
if err != nil {
    return err
}
```

**Level 2 — Wrap with context:**

```go
if err != nil {
    return fmt.Errorf("open config file: %w", err)
}
```

**Level 3 — Branch by error kind:**

```go
if err != nil {
    if errors.Is(err, os.ErrNotExist) {
        config = defaultConfig()
    } else {
        return fmt.Errorf("load config: %w", err)
    }
}
```

**Level 4 — Comprehensive handling:**

```go
if err != nil {
    log.Printf("warning: load user preferences: %v. Using defaults.", err)
    config = defaultConfig()
    metrics.IncrementConfigErrors()
}
```

**Guidelines:**

- Add context that helps with debugging.
- Decide whether to retry, fall back to a default, or abort.
- Log when appropriate.
- Think about what the caller actually needs to know.

## 17. Design the architecture, name the components, document the details

**What it means:** Good design flows through architecture → naming → documentation.

**The process:**

1. **Design the architecture.** Identify major components, consider how pieces interact, plan for concurrency and scaling.
2. **Name the components.** Names carry the design. Good names make code self-documenting. Names should reflect purpose, not implementation.
3. **Document the details.** Explain what code can't convey. Clarify non-obvious behavior. Provide usage examples. Explain the "why" when needed.

**In practice:**

```go
// Architecture: request pipeline with rate limiting.
// Components: RateLimiter, RequestQueue, WorkerPool.
// Names carry the design.

type RateLimiter struct {
    // Limits requests per second across all workers.
    // Uses a token bucket algorithm.
}

type RequestQueue struct {
    // Thread-safe queue with priority support.
    // Blocks when full to apply backpressure.
}

type WorkerPool struct {
    // Manages a fixed number of concurrent workers.
    // Auto-scales based on queue depth.
}
```

## 18. Documentation is for users

**What it means:** Write documentation from the user's perspective, not the implementer's.

**Why it matters:**

- Users don't care how it works; they care how to use it.
- Godoc is what users see first.
- Good docs reduce support burden.

**Common mistake:**

```go
// Bad: describes implementation
// ProcessData takes a Data struct and calls internal methods
// to validate and transform it using a series of pipes.
func ProcessData(d Data) error

// Good: describes purpose and usage
// ProcessData validates and normalizes the data for storage.
// It returns an error if validation fails.
//
// Example:
//
//   if err := ProcessData(data); err != nil {
//       log.Fatal(err)
//   }
func ProcessData(d Data) error
```

**Guidelines:**

- Start with what it does, not how.
- Include examples in doc comments.
- Explain parameters and return values.
- Mention important edge cases.
- Write for someone who has never seen your code.

## 19. Don't panic

**What it means:** Panics should be rare and reserved for truly exceptional situations.

**Why it matters:**

- Panics are hard to recover from properly.
- They bypass normal error handling.
- They can crash the entire program.
- They make code harder to test.

**When to panic:**

- Programmer errors (impossible conditions in correct code).
- Initialization failures that make the program unusable.
- Violating invariants that should never happen.

**When NOT to panic:**

- Expected errors (file not found, network timeout).
- User input validation.
- Anything that can happen during normal operation.
- Library code (almost never).

```go
// Bad: panics on expected errors
func LoadConfig(path string) Config {
    data, err := os.ReadFile(path)
    if err != nil {
        panic(err) // file might not exist!
    }
    // ...
}

// Good: returns errors
func LoadConfig(path string) (Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return Config{}, fmt.Errorf("reading config: %w", err)
    }
    // ...
}

// Acceptable panic: programmer error
func process(index int, items []Item) {
    if index < 0 || index >= len(items) {
        panic("index out of bounds: should never happen")
    }
    // ...
}
```

---
