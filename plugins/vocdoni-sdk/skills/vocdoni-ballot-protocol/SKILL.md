---
name: vocdoni-ballot-protocol
description: Use this skill whenever the user is reasoning about the *encoding* of Vocdoni ballots and results — the protocol layer underneath the SDK. Triggers on questions like "what shape is the vote array", "how are results aggregated", "what does my Vote([2,1,2]) actually mean", "how do I read the result matrix", "what's the difference between maxCount and maxValue", "why does my quadratic vote cost N²", "what is costExponent really", "discrete vs index-weighted aggregation", or any debugging session where the agent has to walk the user through how a numeric ballot maps to a tally. Also use when explaining how an unfamiliar election variant (approval, ranked, quadratic, multi-question) works at the bit-level. Pairs with the vocdoni-sdk skill — vocdoni-sdk teaches the API, this skill teaches the data model the API serialises into.
---

# Vocdoni Ballot Protocol

A small, deliberate specification for how Vocdoni encodes ballots and accumulates results. Everything the SDK does ends up serialised into this shape — knowing it makes the SDK's `IVoteType` fields make sense and lets you debug "why does my vote array produce those results" without guessing.

This is the **data model** under the API. Read [[vocdoni-sdk]] for the SDK call surface that produces and consumes these ballots.

## Core idea

A **voting process** has one or more **fields**. Each field is either:

- a *question* (single-choice-multiquestion elections — `Vote([q1_choice, q2_choice, …])`), or
- an *option* of a single question (approval, multichoice, budget, quadratic, ranked — `Vote([opt1_value, opt2_value, …])`).

A **ballot** is an array of natural numbers, one entry per field. Each entry is the voter's *value* for that field.

**Results** are accumulated in a matrix:

- rows = fields
- columns = possible values for that field (`0`, `1`, …, `maxValue`)
- cell `results[i][j]` = number of voters who put value `j` in field `i`

So results are *not* a per-option vote count — they're a histogram over (field, value) pairs. To get a per-option tally, the client applies an interpretation (index-weighted or discrete-counting; see below).

## Protocol parameters

These are stored on-chain per election and constrain what ballots are valid.

| Parameter         | Type    | Meaning                                                                                                                             |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `maxCount`        | `uint8`  | Number of fields per ballot. Range: `1 ≤ maxCount ≤ 100`.                                                                          |
| `maxValue`        | `uint8`  | Maximum value any field may take. `0` is a special marker meaning "values are amounts to aggregate" (budget/quadratic).             |
| `minValue`        | `uint8`  | Minimum value any field may take.                                                                                                   |
| `uniqueValues`    | `bool`   | If `true`, no value may appear twice in a single ballot (used by ranked voting).                                                    |
| `maxTotalCost`    | `uint16` | Upper bound on `Σ(value[i] ^ costExponent)`. `0` means "no limit / not applicable".                                                 |
| `minTotalCost`    | `uint16` | Lower bound on the same sum. `0` means "no limit".                                                                                  |
| `costExponent`    | `uint16` | Exponent applied per-value when computing the total cost. **Stored scaled by 10 000** on chain (see "costExponent scaling" below).  |

### Cost formula

```
totalCost = Σ (value[i] ^ costExponent)
```

A ballot is valid only if `minTotalCost ≤ totalCost ≤ maxTotalCost` (each bound ignored when set to `0`).

For quadratic voting (`costExponent = 2`):

```
Vote([2, 2, 2, 0])  cost = 2² + 2² + 2² + 0² = 12
Vote([1, 1, 2, 2])  cost = 1² + 1² + 2² + 2² = 10
Vote([0, 3, 1, 1])  cost = 0² + 3² + 1² + 1² = 11
```

### `costExponent` scaling

On chain, `costExponent` is stored as `exp × 10 000` so that fractional exponents are representable:

| Stored value  | Effective exponent |
| ------------- | ------------------ |
| `0`           | `0.0000`           |
| `10 000`      | `1.0000`           |
| `20 000`      | `2.0000`           |
| `65 535`      | `6.5535` (max)     |

The SDK's `IVoteType.costExponent` accepts either form depending on context; recipes and the `QuadraticElection` variant use the human-readable form (`2` for quadratic). When in doubt, read what the variant class sets, not the raw protocol value.

## SDK ↔ protocol mapping

These are the corresponding `IVoteType` fields in `@vocdoni/sdk` (see [[vocdoni-sdk]]'s `elections.md`):

| Protocol            | SDK `IVoteType` field   | Notes                                                                                       |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `maxCount`          | `maxCount`              | SDK auto-fills as `questions.length` (multi-question) or `choices.length` (single-question). |
| `maxValue`          | `maxValue`              | SDK auto-fills as `max(choices.length - 1)` across questions. Set to `0` for budget/quadratic. |
| `minValue`          | (no direct field)       | The SDK enforces non-negativity; explicit minima come via election variants.                 |
| `uniqueValues`      | `uniqueChoices`         | Renamed for human clarity. Required by ranked elections.                                     |
| `maxTotalCost`      | `maxTotalCost`          | Election variants set this from `maxBudget` (budget/quadratic).                              |
| `minTotalCost`      | (set by variants)       | `BudgetElection`'s `forceFullBudget` enforces equality via `min = max`.                      |
| `costExponent`      | `costExponent`          | `1` (linear) or `2` (quadratic) in the SDK's human form.                                     |
| `costFromWeight`    | `costFromWeight`        | SDK-only convenience; toggles whether `maxTotalCost` is `0` (use census weight as budget).   |

The SDK's variant classes (`ApprovalElection`, `MultiChoiceElection`, `BudgetElection`, `QuadraticElection`) exist precisely to set the right protocol parameters for common shapes — they're presets, not new on-chain features.

## Results matrix — how to read it

`results[fieldIndex][value]` = number of voters who chose `value` for that field.

### Worked example: rate 3 candidates 0..2

`maxCount = 3`, `maxValue = 2`, three voters:

```
Vote([2,1,2])  → Lennon=2, Hendrix=1, Joplin=2
Vote([0,1,2])  → Lennon=0, Hendrix=1, Joplin=2
Vote([0,0,0])  → all zeros
```

After accumulation:

```
results = [
  [2, 0, 1],   // field 0 (Lennon):  value 0 chosen by 2 voters, value 1 by 0, value 2 by 1
  [1, 2, 0],   // field 1 (Hendrix): value 0 by 1, value 1 by 2, value 2 by 0
  [1, 0, 2],   // field 2 (Joplin):  value 0 by 1, value 1 by 0, value 2 by 2
]
```

Interpretation (index-weighted): for each field, multiply each count by its column index and sum:

```
Lennon  = 2·0 + 0·1 + 1·2 = 2
Hendrix = 1·0 + 2·1 + 0·2 = 2
Joplin  = 1·0 + 0·1 + 2·2 = 4
Total ballots = (2+0+1) = (1+2+0) = (1+0+2) = 3
```

That's the score per candidate. The on-chain matrix is the raw histogram; the score is computed off-chain by clients.

## Result interpretation modes

The scrutinizer returns the raw histogram; clients pick one of two aggregations driven by election metadata:

```json
"results": {
  "aggregation": "index-weighted",  // or "discrete-counting"
  "display": "rating"                // "rating" | "simple-question" | "multiple-choice" | "linear-weighted" | "quadratic-voting" | "multiple-question" | "raw"
}
```

### `index-weighted` — single-question-style

For each field, multiply counts by column index, sum. Works for: rating, single choice, multiple choice, quadratic, linear-weighted ranked.

```
[[1,0,1], [2,0,0], [0,1,1]]
  → [0·1 + 1·0 + 2·1,   0·2 + 1·0 + 2·0,   0·0 + 1·1 + 2·1]
  → [2, 0, 3]
```

Field 0: 2 points, field 1: 0 points, field 2: 3 points.

### `discrete-counting` — multi-question-style

Field values are just counted (each cell stands on its own; no positional weight). Only valid when each field is a separate question with at most one yes/no per ballot field.

```
[[1,2,0], [0,1,2], [1,1,1]]
  → field 1: choice0 = 1, choice1 = 2, choice2 = 0
     field 2: choice0 = 0, choice1 = 1, choice2 = 2
     field 3: choice0 = 1, choice1 = 1, choice2 = 1
```

Use only with the basic multi-question / single-choice configuration. Quadratic / budget / approval cannot use this mode.

## Common parameter recipes (with the protocol values)

Each row shows the canonical parameter combination for a familiar election shape, and what the ballot/results look like.

### Rate a product 0..5

Voters give a star rating from `0` to `5`.

| `maxCount` | `minValue` | `maxValue` | `minTotalCost` | `maxTotalCost` | `costExponent` | `uniqueValues` |
| ---------- | ---------- | ---------- | -------------- | -------------- | -------------- | -------------- |
| `1`        | `0`        | `5`        | —              | —              | —              | `false`        |

Ballots: `[2]`, `[5]`, `[2]` → results: `[ [0,0,2,0,0,1] ]` (two votes for 2 stars, one for 5).

### Rate N candidates 0..M, ranks may not repeat

Three candidates, scores 0..2 — but each score used at most once (ranking).

| `maxCount` | `minValue` | `maxValue` | `minTotalCost` | `maxTotalCost` | `costExponent` | `uniqueValues` |
| ---------- | ---------- | ---------- | -------------- | -------------- | -------------- | -------------- |
| `3`        | `0`        | `2`        | —              | —              | —              | `true`         |

Ballots: `[2,1,2]`, `[0,1,2]`, `[0,0,0]` → see worked example above.

### Single choice (out of three)

Pick exactly one of three options.

| `maxCount` | `minValue` | `maxValue` | `minTotalCost` | `maxTotalCost` | `costExponent` | `uniqueValues` |
| ---------- | ---------- | ---------- | -------------- | -------------- | -------------- | -------------- |
| `3`        | `0`        | `1`        | `1`            | `1`            | —              | `false`        |

Ballot shape: `[v0, v1, v2]` where each `v_i ∈ {0, 1}` and `Σ v_i = 1`. (i.e. exactly one of the positions is `1`.)

Ballots: `[0,1,0]`, `[0,1,0]`, `[0,0,1]` → results: `[ [3,0,0], [1,2,0], [2,1,0] ]`.

Per-option (index-weighted): `[0·3 + 1·0 + 2·0, 0·1 + 1·2 + 2·0, 0·2 + 1·1 + 2·0] = [0, 2, 1]`.

### Approval voting

"Choose any subset of N options." 5 options, between 0 and N approvals (or with a `min/max` budget on the count itself).

| `maxCount` | `minValue` | `maxValue` | `minTotalCost` | `maxTotalCost` | `costExponent` | `uniqueValues` |
| ---------- | ---------- | ---------- | -------------- | -------------- | -------------- | -------------- |
| `5`        | `0`        | `1`        | `3`            | `3`            | —              | `false`        |

The `minTotalCost = maxTotalCost = 3` forces exactly 3 approvals. Set both to `0` for unlimited.

Ballots: `[1,1,1,0,0]`, `[0,1,1,1,0]`, `[1,1,1,0,0]` → results: `[ [1,2], [0,3], [0,3], [2,1], [3,0] ]`. Approval count per option: `[2, 3, 3, 1, 0]`.

### Linear weighted (ranked) choice

Sort 5 options; rank `0..4`, each used once.

| `maxCount` | `minValue` | `maxValue` | `minTotalCost` | `maxTotalCost` | `costExponent` | `uniqueValues` |
| ---------- | ---------- | ---------- | -------------- | -------------- | -------------- | -------------- |
| `5`        | `0`        | `4`        | —              | —              | —              | `true`         |

The `uniqueValues = true` enforces "no rank used twice".

### Quadratic voting

Distribute 12 credits across 4 NGOs; cost = `value²`.

| `maxCount` | `minValue` | `maxValue` | `minTotalCost` | `maxTotalCost` | `costExponent` | `uniqueValues` |
| ---------- | ---------- | ---------- | -------------- | -------------- | -------------- | -------------- |
| `4`        | `0`        | `0` *      | `0`            | `12`           | `2`            | `false`        |

\* `maxValue = 0` here is the "values are aggregable amounts" marker — the upper bound on each individual value comes from `maxTotalCost` and `costExponent`.

Example ballots and their costs:

```
[2,2,2,0]   cost = 4 + 4 + 4 + 0 = 12 ✓
[1,1,2,2]   cost = 1 + 1 + 4 + 4 = 10 ✓
[0,3,1,1]   cost = 0 + 9 + 1 + 1 = 11 ✓
[3,3,0,0]   cost = 9 + 9 + 0 + 0 = 18 ✗ (over 12)
```

### Multi-question, single choice per question

3 positions (CEO, COO, CFO), 5 candidates per position.

| `maxCount` | `minValue` | `maxValue` | `minTotalCost` | `maxTotalCost` | `costExponent` | `uniqueValues` |
| ---------- | ---------- | ---------- | -------------- | -------------- | -------------- | -------------- |
| `3`        | `0`        | `4`        | —              | —              | —              | `false`        |

Ballots: `[4,3,2]`, `[4,2,3]`, `[0,1,4]` → results `[ [1,0,0,0,2], [0,1,1,1,0], [0,0,1,1,1] ]`.

This is the case to use `discrete-counting`: read each field as "votes per candidate for this position", *not* as "weighted points".

## Why this matters for the SDK user

1. **Vote-shape errors stop being mysterious.** `Vote([…])` is exactly the on-chain ballot. When the SDK throws `Invalid vote`, the message is about violating one of `maxCount` / `maxValue` / `uniqueValues` / `maxTotalCost`. Look at the protocol params; the SDK is just a thin checker around them.
2. **Results are a histogram, not a tally.** If you `console.log(election.results)` and see a matrix instead of a per-option count, it's not a bug. Pick the right interpretation (`index-weighted` or `discrete-counting`) for the election type — see "Result interpretation modes".
3. **Variants are presets, not new primitives.** `ApprovalElection`, `MultiChoiceElection`, `BudgetElection`, `QuadraticElection` set protocol parameters for you. Knowing the underlying parameters helps you (a) understand why the variant is constrained the way it is, and (b) build a custom shape via the base `Election.from(...)` when no variant fits.
4. **`maxValue = 0` is a flag, not zero.** It means "field values are aggregable amounts whose cap comes from `maxTotalCost` and `costExponent`" — used by budget and quadratic. Don't read it as "each value can be at most 0".

## Cross-references

- [[vocdoni-sdk]] — the SDK that produces and consumes ballots of this shape.
  - `references/elections.md` — `IVoteType` fields that map to these protocol parameters.
  - `references/election-types.md` — which preset (Approval/MultiChoice/Budget/Quadratic) sets which parameters.
  - `references/voting.md` — `Vote([…])` shape per election kind.
  - `references/results.md` — reading `election.results` matrices.
- Vocdoni blog post: <https://blog.vocdoni.io/vocdoni-ballot-protocol/>
