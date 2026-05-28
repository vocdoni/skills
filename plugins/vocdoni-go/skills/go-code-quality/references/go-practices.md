# Go Practices Reference

Use this reference when applying the [[go-code-quality]] skill to non-trivial Go work. It is intentionally opinionated and curated for production code.

Companion skills:

- [[go-best-practices]] — Rob Pike's *Go Proverbs* (philosophical/architectural defaults).
- [[go-modern]] — version-aware modern Go syntax (which features to use at the target Go version).

## Source map

Primary sources used to curate these rules:

- Effective Go: https://go.dev/doc/effective_go
- Go Code Review Comments: https://go.dev/wiki/CodeReviewComments
- Errors are values: https://go.dev/blog/errors-are-values
- Working with Errors in Go 1.13: https://go.dev/blog/go1.13-errors
- Organizing a Go module: https://go.dev/doc/modules/layout
- Go Security: https://go.dev/doc/security/
- Package names: https://go.dev/blog/package-names
- Google Go Style: https://google.github.io/styleguide/go/
- Google Go Style Decisions: https://google.github.io/styleguide/go/decisions
- Google Go Style Best Practices: https://google.github.io/styleguide/go/best-practices
- Uber Go Style Guide: https://github.com/uber-go/guide/blob/master/style.md

## 1. Domain Types and Type Safety

### Prefer named domain types over primitive obsession

Bad:

```go
func CastVote(voterID string, electionID string, weight string, kind string) error
```

Good:

```go
type VoterID string
type ElectionID string
type VoteWeight uint64

type VoteKind string

const (
	VoteKindApproval VoteKind = "approval"
	VoteKindRanked   VoteKind = "ranked"
)

func CastVote(voterID VoterID, electionID ElectionID, weight VoteWeight, kind VoteKind) error
```

Use named types when a primitive represents:

- identifiers: `UserID`, `ElectionID`, `ChainID`, `ProcessID`
- state or category: `Status`, `Role`, `Mode`, `Phase`, `Network`
- quantities with units: `Amount`, `TokenWeight`, `BlockHeight`, `Index`
- protocol concepts: `Method`, `EnvelopeType`, `Hash`, `Signature`

### Do not use `string` as a trunk for structured data

Avoid passing opaque strings through the program and repeatedly parsing them. Parse once at the boundary, validate, and pass typed values internally.

Bad:

```go
func Submit(network string, processID string, payload string) error
```

Good:

```go
type Network string
type ProcessID [32]byte
type BallotPayload []byte

func Submit(network Network, processID ProcessID, payload BallotPayload) error
```

### Use typed enums instead of raw strings

For external JSON/API values, string enums are often best:

```go
type ProcessStatus string

const (
	ProcessStatusDraft   ProcessStatus = "draft"
	ProcessStatusOpen    ProcessStatus = "open"
	ProcessStatusClosed  ProcessStatus = "closed"
	ProcessStatusArchived ProcessStatus = "archived"
)

func (s ProcessStatus) Valid() bool {
	switch s {
	case ProcessStatusDraft, ProcessStatusOpen, ProcessStatusClosed, ProcessStatusArchived:
		return true
	default:
		return false
	}
}
```

For internal numeric state, use `iota` and consider starting at one so zero means unset/invalid:

```go
type Phase uint8

const (
	PhaseUnknown Phase = iota
	PhaseSetup
	PhaseCommit
	PhaseReveal
	PhaseDone
)
```

Never compare a domain enum to a raw literal outside its declaration or parser.

### Avoid boolean parameters when meaning is unclear

Bad:

```go
func NewProcess(encrypted bool, anonymous bool) *Process
```

Good:

```go
type PrivacyMode uint8

const (
	PrivacyPublic PrivacyMode = iota + 1
	PrivacyAnonymous
)

type EncryptionMode uint8

const (
	EncryptionNone EncryptionMode = iota + 1
	EncryptionThreshold
)

func NewProcess(privacy PrivacyMode, encryption EncryptionMode) *Process
```

Use booleans only when the call site is obvious, for example `SetEnabled(true)`. For multiple options, prefer an options struct.

### Avoid `any` and `map[string]any` except at boundaries

Use `any` only when arbitrary values are the real API contract. For JSON or dynamic external input, decode into a typed struct as soon as possible. Keep `map[string]any` at the serialization/deserialization edge.

### Use standard domain types

Prefer standard library types over ad hoc strings and integers:

- `time.Time` for instants
- `time.Duration` for durations
- `url.URL` for URLs
- `net/netip.Addr` or `netip.Prefix` for IP addresses
- `io.Reader` / `io.Writer` for streams
- `context.Context` for request-scoped cancellation and deadlines

## 2. Errors, Panics, and Logging

### Return errors for expected failures

Use explicit return values:

```go
func LoadConfig(path string) (*Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %q: %w", path, err)
	}
	// ...
	return cfg, nil
}
```

Do not use sentinel return values like `""`, `0`, or `nil` to mean failure unless the value is normal and the API also returns `ok` or `error`.

### Do not panic for normal error handling

Panics are acceptable only for:

- impossible invariants where continuing would corrupt state
- package initialization failures that must abort startup, often via `template.Must`-style helpers
- programmer errors in small internal helpers where the caller contract has already been violated and recovery is not useful

Panics are not acceptable for bad user input, missing files, validation errors, network failures, database failures, parsing failures, type assertion failures, or unsupported enum values.

### Use comma-ok type assertions

Bad:

```go
name := v.(string)
```

Good:

```go
name, ok := v.(string)
if !ok {
	return fmt.Errorf("name has type %T, want string", v)
}
```

### Wrap errors with context

Good error context usually follows `verb object: %w`:

```go
if err := s.store.Save(ctx, process); err != nil {
	return fmt.Errorf("save process %s: %w", process.ID, err)
}
```

Avoid context that only repeats the callee name. Add the operation and relevant domain identifier.

### Decide whether `%w` is part of the API contract

Use `%w` when callers should be able to use `errors.Is` or `errors.As` on the underlying error.

Use `%v` or map to a package-level error when wrapping would expose an implementation detail such as a database package, HTTP client, storage backend, or low-level parser that your package may replace later.

### Define public error contracts intentionally

If callers need to branch on an error, expose one of:

- a sentinel error: `var ErrNotFound = errors.New("not found")`
- a typed error: `type NotFoundError struct { ID ProcessID }`
- a predicate: `func IsNotFound(err error) bool`

Document exported error behavior in the function comment.

### Handle errors once

At intermediate layers, return errors. At application boundaries, log or convert to a user-visible response.

Bad:

```go
if err != nil {
	log.Printf("save failed: %v", err)
	return err
}
```

Good:

```go
if err != nil {
	return fmt.Errorf("save vote: %w", err)
}
```

Then at the boundary:

```go
if err := svc.Submit(ctx, req); err != nil {
	logger.Error("submit vote", "error", err)
	return http.StatusInternalServerError
}
```

### Error string style

Error strings should be lowercase and should not end in punctuation.

Good:

```go
return errors.New("missing process id")
```

Bad:

```go
return errors.New("Missing process ID.")
```

### Avoid discarding errors

Never write `_ = f.Close()` by habit. If cleanup errors matter, handle them. If they do not matter, make that clear:

```go
defer func() {
	if err := rows.Close(); err != nil {
		logger.Warn("close rows", "error", err)
	}
}()
```

In library code without a logger, consider joining cleanup errors with the main error when the API can benefit from it.

## 3. API and Package Design

### Keep package names short, lowercase, and meaningful

Avoid `util`, `common`, `helper`, `types`, `models`, and `interfaces` packages. A package should be named for what it provides, not that it is miscellaneous.

Exported names are read with the package name. Avoid repetition:

- `store.Client`, not `store.StoreClient`
- `process.New`, not `process.NewProcess` when the package has one primary type
- `ballot.Parser`, not `ballot.BallotParser`

### Return concrete types from constructors

Bad:

```go
type Service interface { Run(context.Context) error }
func NewService(...) Service
```

Good:

```go
type Service struct { ... }
func NewService(...) *Service
```

Define interfaces in the consumer package when needed. This keeps implementors free to add methods and avoids fake interfaces created only for mocks.

### Keep interfaces small and behavior-shaped

Good interfaces describe behavior and often have one or two methods:

```go
type VoteStore interface {
	SaveVote(context.Context, Vote) error
}
```

Do not create interfaces just to mirror a concrete type. Do not use `interface{}` as an escape hatch.

### Use options structs for growing parameter lists

Bad:

```go
func Start(addr string, timeout time.Duration, tls bool, maxConns int, debug bool) error
```

Good:

```go
type ServerOptions struct {
	Addr     string
	Timeout  time.Duration
	TLS      bool
	MaxConns int
	Debug    bool
}

func Start(ctx context.Context, opts ServerOptions) error
```

Use functional options only when callers need sparse optional configuration and the extra indirection is justified.

### Be careful with pointer parameters

Do not pass pointers to small immutable primitives just to avoid copying. Avoid `*string`, `*bool`, `*int`, and pointers to interfaces unless representing optional/tri-state semantics is truly required.

### Receiver choice

Use pointer receivers when the method mutates the receiver, the receiver contains a mutex/synchronization field, the struct is large, or consistency across methods favors a pointer.

Use value receivers for small immutable value types. Do not mix pointer and value receivers without a strong reason.

## 4. Context, Concurrency, and Resources

### Context is explicit and first

```go
func (s *Service) SubmitVote(ctx context.Context, vote Vote) error
```

Do not store `context.Context` in a struct. Do not pass `nil` context. Use `context.Background()` only at top-level roots such as `main`, tests, or process startup.

### Goroutines need lifetimes

Every goroutine must have at least one of:

- a context or channel cancellation path
- a known finite loop
- a documented owner responsible for stopping it
- a wait mechanism such as `sync.WaitGroup` or `errgroup.Group`

Avoid fire-and-forget goroutines in production code.

### Prefer synchronous APIs

Expose synchronous functions and let callers add concurrency. This keeps lifetimes, cancellation, testing, and error propagation simpler.

### Clean up resources close to acquisition

Use `defer` for files, locks, spans, temporary directories, and other resources when it makes lifetime obvious. Check cleanup errors when they can change the result or reveal data loss.

### Avoid unbounded concurrency

When launching goroutines over inputs, consider bounds, backpressure, and cancellation. Use worker pools, semaphores, or errgroup with limits when appropriate.

### Use typed atomics or mutexes carefully

Prefer clear synchronization. Avoid raw shared variables. When using atomics, prefer typed atomic wrappers when available in the project, and never mix atomic and non-atomic access to the same variable.

## 5. Data Structures and Boundaries

### Copy slices and maps at trust boundaries

Slices and maps are references to mutable data. Copy them when storing inputs or returning internal state if mutation would violate invariants.

```go
func NewBallot(choices []Choice) Ballot {
	return Ballot{choices: slices.Clone(choices)}
}
```

### Nil slices are usually fine

Prefer nil slices as the zero value. Only force empty-but-non-nil slices when an external encoding requires it, for example JSON `[]` rather than `null`.

### Use field names in struct literals outside very local code

Field names make code robust to field order changes and clearer when adjacent fields share a type.

```go
cfg := Config{
	Addr:    addr,
	Timeout: 5 * time.Second,
}
```

### Avoid mutable globals

Use dependency injection for clocks, random sources, stores, loggers, and network clients. Mutable globals make tests order-dependent and can race.

## 6. Testing

### Test behavior and edge cases

Cover success, failure, empty input, invalid enum values, boundary quantities, context cancellation, and error wrapping behavior when it is part of the API.

### Use table-driven tests when cases share logic

```go
func TestStatusValid(t *testing.T) {
	tests := []struct {
		name string
		in   ProcessStatus
		want bool
	}{
		{name: "open", in: ProcessStatusOpen, want: true},
		{name: "unknown", in: ProcessStatus("unknown"), want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.in.Valid(); got != tt.want {
				t.Errorf("ProcessStatus(%q).Valid() = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}
```

### Useful failure messages

Failure messages should include:

- the function or behavior under test
- the inputs when relevant
- `got` before `want`
- error details or diffs for complex structs

### Test helpers

Use `t.Helper()` in setup helpers. Do not hide assertion logic in helpers when it makes failures unclear. Helpers that validate reusable logic can return an error instead of taking `*testing.T`.

### Avoid panics in tests

Use `t.Fatal`, `t.Fatalf`, or returned errors in helpers. Do not panic from tests except in extremely small prototypes.

### Use fuzz/property tests for parsers and encoders

For parsers, decoders, cryptographic serialization, and protocol boundary code, consider fuzz tests and round-trip properties.

## 7. Security and Robustness

### Validate at boundaries

Validate untrusted input immediately at API, HTTP, CLI, database, JSON, protobuf, and network boundaries. Convert to domain types before passing inward.

### Prefer `crypto/rand` for security-sensitive randomness

Do not use `math/rand` for tokens, keys, nonces, salts, passwords, or security-critical identifiers.

### Avoid `unsafe`

Do not use `unsafe` unless there is a documented, reviewed, measured reason. Prefer standard library or safe alternatives. If `unsafe` is unavoidable, isolate it, test it heavily, and document invariants.

### Time and cryptography

Use `time` types, not integer timestamps, inside the program. Use constant-time comparison for secrets. Do not invent cryptographic protocols or serialization formats casually.

## 8. Tooling and Formatting

Run or recommend these tools when applicable:

```bash
gofmt -w .
goimports -w .
go test ./...
go test -race ./...
go vet ./...
govulncheck ./...
staticcheck ./...
```

Do not spend review energy on formatting that `gofmt` will fix. Focus on semantics and maintainability.

## 9. Code Review Checklist

Use this checklist for reviews:

1. Are domain concepts represented by named types instead of raw primitives?
2. Are enum-like values typed constants with validation/parsing where needed?
3. Are errors returned instead of panics for expected failures?
4. Is each error handled exactly once?
5. Are errors wrapped with enough context and with `%w` only when the underlying error is part of the contract?
6. Are error strings lowercase and punctuation-free?
7. Are contexts passed explicitly and not stored?
8. Are goroutine lifetimes bounded and waitable?
9. Are interfaces located at the consumer boundary and kept small?
10. Are package names meaningful and non-repetitive with exported symbols?
11. Are slices/maps copied at mutable boundaries?
12. Are tests meaningful, table-driven where useful, and reporting got/want?
13. Are security-sensitive areas using safe randomness, validation, and no unnecessary `unsafe`?
14. Does the code compile under `go test ./...` and pass formatting/import tools?

## 10. Common Review Comments Ready to Reuse

- "This parameter is a domain concept, not just a string. Please introduce a named type and constants so invalid values are harder to pass accidentally."
- "This function can fail, so it should return an error instead of panicking. Let the caller decide whether to log, retry, return HTTP 4xx/5xx, or abort."
- "This layer logs and returns the same error, which will likely duplicate logs. Please wrap and return here, then log once at the boundary."
- "Use `%w` only if callers should be able to match the underlying error. If the storage/backend error is an implementation detail, map it to a package error or use `%v`."
- "The goroutine needs an explicit lifetime: cancellation, a bounded loop, and a way for the owner to wait for it to exit."
- "This interface is defined by the producer and mirrors the implementation. Return a concrete type here; define a small interface in the consumer package if needed."
- "Avoid `map[string]any` past the decoding boundary. Decode into a typed struct and validate once."
- "The test failure should show the input, got value, and want value so a future maintainer can debug it without re-running locally."
