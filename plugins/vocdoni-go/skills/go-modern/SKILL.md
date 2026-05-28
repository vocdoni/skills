---
name: go-modern
description: Use this skill when writing, reviewing, or refactoring Go code. Detects the project's Go version from go.mod and applies only language features available in that version - modern built-ins like slices/maps/cmp, type-safe atomics, errors.Join, range-over-int, t.Context(), omitzero, b.Loop(), strings.SplitSeq, wg.Go(), new(val), errors.AsType. Avoids both outdated patterns and features from newer-than-target versions.
---

# Modern Go

## Detected Go version

!`grep -rh "^go " --include="go.mod" . 2>/dev/null | cut -d' ' -f2 | sort | uniq -c | sort -nr | head -1 | xargs | cut -d' ' -f2 | grep . || echo unknown`

The line above is a skill directive — the shell command is run when this skill loads, and its output replaces the `!` line. Use whatever version appears there. Searching for `go.mod` yourself is wasted work because the detection has already happened.

## How to use this skill

**Version detected:**

Briefly tell the user the target version once, in your own words, and offer to change it if they prefer. Don't list features. Don't ask for confirmation. Then write code to that target.

**Version is `unknown`:**

Tell the user no version was detected and ask which to target using `AskUserQuestion` with `1.23` / `1.24` / `1.25` / `1.26` as options.

**When writing Go code:**

Use every applicable feature from this document up to the target version. The point of this skill is to keep both edges in check: don't reach for features the target Go version doesn't have yet (the code won't compile for the user), and don't write the legacy form when a modern alternative is available (it'll look dated in review).

---

## Features by Go version

### Go 1.0+

- `time.Since`: `time.Since(start)` instead of `time.Now().Sub(start)`.

### Go 1.8+

- `time.Until`: `time.Until(deadline)` instead of `deadline.Sub(time.Now())`.

### Go 1.13+

- `errors.Is`: `errors.Is(err, target)` instead of `err == target` (works with wrapped errors).

### Go 1.18+

- `any`: use `any` instead of `interface{}`.
- `bytes.Cut`: `before, after, found := bytes.Cut(b, sep)` instead of Index+slice.
- `strings.Cut`: `before, after, found := strings.Cut(s, sep)`.

### Go 1.19+

- `fmt.Appendf`: `buf = fmt.Appendf(buf, "x=%d", x)` instead of `[]byte(fmt.Sprintf(...))`.
- `atomic.Bool` / `atomic.Int64` / `atomic.Pointer[T]`: type-safe atomics instead of `atomic.StoreInt32`.

```go
var flag atomic.Bool
flag.Store(true)
if flag.Load() { /* ... */ }

var ptr atomic.Pointer[Config]
ptr.Store(cfg)
```

### Go 1.20+

- `strings.Clone`: `strings.Clone(s)` to copy a string without sharing memory.
- `bytes.Clone`: `bytes.Clone(b)` to copy a byte slice.
- `strings.CutPrefix` / `CutSuffix`: `if rest, ok := strings.CutPrefix(s, "pre:"); ok { ... }`.
- `errors.Join`: `errors.Join(err1, err2)` to combine multiple errors.
- `context.WithCancelCause`: `ctx, cancel := context.WithCancelCause(parent)` then `cancel(err)`.
- `context.Cause`: `context.Cause(ctx)` returns the error that caused cancellation.

### Go 1.21+

**Built-ins:**

- `min` / `max`: `max(a, b)` instead of `if`/`else` comparisons.
- `clear`: `clear(m)` to delete all map entries, `clear(s)` to zero slice elements.

**slices package:**

- `slices.Contains(items, x)` instead of manual loops.
- `slices.Index(items, x)` returns the index (`-1` if not found).
- `slices.IndexFunc(items, func(item T) bool { return item.ID == id })`.
- `slices.SortFunc(items, func(a, b T) int { return cmp.Compare(a.X, b.X) })`.
- `slices.Sort(items)` for ordered types.
- `slices.Max(items)` / `slices.Min(items)` instead of manual loops.
- `slices.Reverse(items)` instead of a manual swap loop.
- `slices.Compact(items)` removes consecutive duplicates in place.
- `slices.Clip(s)` removes unused capacity.
- `slices.Clone(s)` creates a copy.

**maps package:**

- `maps.Clone(m)` instead of manual map iteration.
- `maps.Copy(dst, src)` copies entries from `src` to `dst`.
- `maps.DeleteFunc(m, func(k K, v V) bool { return cond })`.

**sync package:**

- `sync.OnceFunc`: `f := sync.OnceFunc(func() { ... })` instead of `sync.Once` + wrapper.
- `sync.OnceValue`: `getter := sync.OnceValue(func() T { return computeValue() })`.

**context package:**

- `context.AfterFunc`: `stop := context.AfterFunc(ctx, cleanup)` runs `cleanup` on cancellation.
- `context.WithTimeoutCause(parent, d, err)`.
- `context.WithDeadlineCause` (same idea with a deadline).

### Go 1.22+

**Loops:**

- `for i := range n`: `for i := range len(items)` instead of `for i := 0; i < len(items); i++`.
- Loop variables are now safe to capture in goroutines (each iteration has its own copy).

**cmp package:**

- `cmp.Or(flag, env, config, "default")` returns the first non-zero value.

```go
// Instead of:
name := os.Getenv("NAME")
if name == "" {
    name = "default"
}
// Use:
name := cmp.Or(os.Getenv("NAME"), "default")
```

**reflect package:**

- `reflect.TypeFor[T]()` instead of `reflect.TypeOf((*T)(nil)).Elem()`.

**net/http:**

- Enhanced `http.ServeMux` patterns: `mux.HandleFunc("GET /api/{id}", handler)` with method and path params.
- `r.PathValue("id")` to read path parameters.

### Go 1.23+

- `maps.Keys(m)` / `maps.Values(m)` return iterators.
- `slices.Collect(iter)` instead of a manual append loop.
- `slices.Sorted(iter)` to collect and sort in one step.

```go
keys := slices.Collect(maps.Keys(m))       // not: for k := range m { keys = append(keys, k) }
sortedKeys := slices.Sorted(maps.Keys(m))  // collect + sort
for k := range maps.Keys(m) {              // iterate directly
    process(k)
}
```

**time package:**

- `time.Tick`: use freely. As of Go 1.23 the garbage collector reclaims unreferenced tickers even if `Stop` was not called. There is no longer any reason to prefer `NewTicker` when `Tick` will do.

### Go 1.24+

- `t.Context()` instead of `context.WithCancel(context.Background())` in tests — the context cancels when the test ends, so the boilerplate goes away.

Before:

```go
func TestFoo(t *testing.T) {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()
    result := doSomething(ctx)
}
```

After:

```go
func TestFoo(t *testing.T) {
    ctx := t.Context()
    result := doSomething(ctx)
}
```

- `omitzero` instead of `omitempty` in JSON struct tags — especially for `time.Duration`, `time.Time`, structs, slices, and maps, where `omitempty` either doesn't fire or fires on the wrong thing.

Before:

```go
type Config struct {
    Timeout time.Duration `json:"timeout,omitempty"` // doesn't work for Duration!
}
```

After:

```go
type Config struct {
    Timeout time.Duration `json:"timeout,omitzero"`
}
```

- `b.Loop()` instead of `for i := 0; i < b.N; i++` in benchmarks — `b.Loop()` lets the framework handle timer management and produces more reliable measurements.

Before:

```go
func BenchmarkFoo(b *testing.B) {
    for i := 0; i < b.N; i++ {
        doWork()
    }
}
```

After:

```go
func BenchmarkFoo(b *testing.B) {
    for b.Loop() {
        doWork()
    }
}
```

- `strings.SplitSeq` instead of `strings.Split` when the result is only iterated — the `Seq` variants don't allocate the intermediate slice.

Before:

```go
for _, part := range strings.Split(s, ",") {
    process(part)
}
```

After:

```go
for part := range strings.SplitSeq(s, ",") {
    process(part)
}
```

Also: `strings.FieldsSeq`, `bytes.SplitSeq`, `bytes.FieldsSeq`.

### Go 1.25+

- `wg.Go(fn)` instead of `wg.Add(1)` + `go func() { defer wg.Done(); ... }()` — same semantics, no chance of forgetting the `Add`/`Done` pairing.

Before:

```go
var wg sync.WaitGroup
for _, item := range items {
    wg.Add(1)
    go func() {
        defer wg.Done()
        process(item)
    }()
}
wg.Wait()
```

After:

```go
var wg sync.WaitGroup
for _, item := range items {
    wg.Go(func() {
        process(item)
    })
}
wg.Wait()
```

### Go 1.26+

- `new(val)` instead of `x := val; &x` — Go 1.26 extends `new()` to accept expressions, not just types. Type is inferred: `new(0)` → `*int`, `new("s")` → `*string`, `new(T{})` → `*T`. The temp-and-take-address pattern is now noise. Don't add redundant casts like `new(int(0))` either — `new(0)` is what you want. Common use case: struct fields with pointer types.

Before:

```go
timeout := 30
debug := true
cfg := Config{
    Timeout: &timeout,
    Debug:   &debug,
}
```

After:

```go
cfg := Config{
    Timeout: new(30),   // *int
    Debug:   new(true), // *bool
}
```

- `errors.AsType[T](err)` instead of `errors.As(err, &target)` — generic form, no out-parameter, the type comes from the type parameter.

Before:

```go
var pathErr *os.PathError
if errors.As(err, &pathErr) {
    handle(pathErr)
}
```

After:

```go
if pathErr, ok := errors.AsType[*os.PathError](err); ok {
    handle(pathErr)
}
```
