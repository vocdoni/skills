# `references/election-types.md` — Election variants

Companion to the [[vocdoni-sdk]] skill. Use this when the user wants approval, multi-choice, budget, quadratic, or ranked voting — the variant classes that constrain how a ballot is shaped. Read `elections.md` first for the base flow.

## When you need a variant vs the base `Election`

`Election.from(...)` is the right entry point for **single-choice-per-question** elections. That covers vanilla polls, multi-question surveys, anything where the voter picks one of N options per question.

When a voter has to pick **multiple options at once**, **allocate credits**, or **rank choices**, switch to the variant class. Variants:

- Always have **exactly one question** (calling `addQuestion` a second time throws).
- Set `voteType` for you internally — don't override its fields unless you've read the variant's source.
- Emit a `resultsType` in metadata that downstream tools (UIs, indexers) use to render results correctly.

| Variant class           | Use it for…                                                                          | Voter sees…                                | Vote shape                                                         |
| ----------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------ |
| (none, base `Election`) | Single choice per question, any number of questions                                  | Radio button per question                  | `Vote([choice_q1, choice_q2, …])`                                  |
| `ApprovalElection`      | Pick any subset of N options ("approve" or not, per option)                          | Checkbox per option                        | `Vote([0\|1, 0\|1, …])` length = options                           |
| `MultiChoiceElection`   | Pick *between min and max* options, optionally allowing repeats or abstain           | Checkboxes / dropdowns with limits         | `Vote([choice, choice, … abstain?])`                              |
| `BudgetElection`        | Allocate a fixed budget across options (linear cost)                                 | Sliders summing to ≤ budget                | `Vote([alloc_opt1, alloc_opt2, …])`                                |
| `QuadraticElection`     | Allocate credits across options where cost is `value^2` (anti-whale)                 | Sliders with quadratic cost display        | `Vote([credits_opt1, credits_opt2, …])`                            |
| Ranked                  | Rank options 0..N-1 with each option getting a unique score                          | Drag-to-rank                               | `Vote([rank_opt1, rank_opt2, …])` all distinct                     |

Ranked voting is built on top of the base `Election` with a specific `IVoteType` (see below) rather than its own class. The other four have dedicated factory classes.

## Approval voting

"Pick any subset of N options. Each picked option gets +1; each unpicked gets 0."

```ts
import { ApprovalElection } from '@vocdoni/sdk';

const election = ApprovalElection.from({
  title: 'Favourite colours (pick as many as you like)',
  endDate: new Date(Date.now() + 24 * 3600 * 1000),
  census,
});

election.addQuestion('Pick your favourites', '', [
  { title: 'Green',  value: 0 },
  { title: 'Blue',   value: 1 },
  { title: 'Pink',   value: 2 },
  { title: 'Orange', value: 3 },
]);
```

**Auto-set internal `voteType`:** `maxCount = choices.length`, `maxValue = 1`, `maxTotalCost = 0` (no cap).

**Vote shape:** array of `0` (reject) / `1` (approve), one entry per option. Example: `new Vote([0, 1, 0, 1])` approves Blue and Orange.

**Validation:** length must equal options; values must be 0 or 1.

If you want "pick at most N", use `MultiChoiceElection` with `maxNumberOfChoices = N` instead — ApprovalElection has no cap.

## Multi-choice voting

"Pick between *min* and *max* options. Optionally repeat. Optionally abstain."

```ts
import { MultiChoiceElection } from '@vocdoni/sdk';

const election = MultiChoiceElection.from({
  title: 'Pick exactly 2 of your top 4 picks',
  endDate: new Date(Date.now() + 24 * 3600 * 1000),
  census,
  maxNumberOfChoices: 2,
  minNumberOfChoices: 2,     // optional; defaults to no minimum
  canRepeatChoices:   false, // optional; default false
  canAbstain:         false, // optional; default false
});

election.addQuestion('Top 2', '', [
  { title: 'A', value: 0 },
  { title: 'B', value: 1 },
  { title: 'C', value: 2 },
  { title: 'D', value: 3 },
]);
```

**Vote shape:** array of length between `minNumberOfChoices` and `maxNumberOfChoices`, each entry being a choice index (or an abstain marker if enabled).

**Abstain encoding:** when `canAbstain = true`, abstain values are appended after the real choices in the value space — e.g. for 4 options with `canRepeatChoices = true`, value `4` means "abstain"; with `canRepeatChoices = false`, abstain values are `4..(4 + maxNumberOfChoices - 1)`.

## Budget voting

"Each voter gets a budget; allocate it linearly across options."

```ts
import { BudgetElection } from '@vocdoni/sdk';

// Variant A: explicit shared budget
const election = BudgetElection.from({
  title: 'Pick where to spend the grant',
  endDate: new Date(Date.now() + 24 * 3600 * 1000),
  census,
  useCensusWeightAsBudget: false, // discriminator
  maxBudget: 100,                  // every voter has 100 credits
  forceFullBudget: true,           // voter MUST spend all 100
  minStep: 1,                      // smallest increment per option
});

// Variant B: per-voter budget from a WeightedCensus
const election = BudgetElection.from({
  title: '…',
  endDate: new Date(Date.now() + 24 * 3600 * 1000),
  census: weightedCensus,           // each voter's weight is their budget
  useCensusWeightAsBudget: true,
});

election.addQuestion('Allocate', '', [
  { title: 'Health',    value: 0 },
  { title: 'Education', value: 1 },
  { title: 'Climate',   value: 2 },
]);
```

**Vote shape:** `new Vote([n0, n1, n2, …])` where `n_i` is allocation to option `i`. `Σ n_i ≤ maxBudget` (or `= maxBudget` if `forceFullBudget`).

**Cost is linear:** spending 5 on an option costs 5 credits.

## Quadratic voting

"Same as budget but cost is `value^cost`. By default `cost = 2`, so 5 credits to an option cost 25."

```ts
import { QuadraticElection } from '@vocdoni/sdk';

// Variant A: per-voter budget from census weight
const election = QuadraticElection.from({
  title: 'Quadratic funding round',
  endDate: new Date(Date.now() + 24 * 3600 * 1000),
  census: weightedCensus,
  useCensusWeightAsBudget: true,
  quadraticCost: 2,        // default
  // forceFullBudget?: false,
  // minStep?: 1,
});

// Variant B: explicit shared budget
const election = QuadraticElection.from({
  title: '…',
  endDate: new Date(Date.now() + 24 * 3600 * 1000),
  census,
  useCensusWeightAsBudget: false,
  maxBudget: 14,
  quadraticCost: 2,
});

election.addQuestion("NGOs", '', [
  { title: 'Greenpeace', value: 0 },
  { title: 'Red Cross',  value: 1 },
  { title: 'MSF',        value: 2 },
  { title: 'Amnesty',    value: 3 },
]);
```

**Cost formula:** `Σ (votes[i] ^ quadraticCost)` must be ≤ budget. With `quadraticCost = 2`:

```
Vote([1, 0, 3, 2])  cost = 1² + 0² + 3² + 2² = 14
```

If your budget is 14, this vote spends all of it.

**Vote shape:** `new Vote([n0, n1, n2, …])`. Values are credits *to spend* on each option, not the squared cost.

## Ranked voting

Ranked / linear-weighted-choice is the base `Election` with these constraints:

```ts
import { Election, IVoteType } from '@vocdoni/sdk';

const VOTE_OPTIONS: IVoteType = {
  uniqueChoices: true,    // every option must get a unique rank
  costFromWeight: false,
  maxCount:    5,         // = number of options
  maxValue:    4,         // = number of options - 1 (rank 0..4)
  maxTotalCost: 0,
};

const election = Election.from({
  title: 'Sort by preference',
  endDate: new Date(Date.now() + 24 * 3600 * 1000),
  census,
  voteType: VOTE_OPTIONS,
});

election.addQuestion('Rank these', '', [
  { title: 'Bitcoin',  value: 0 },
  { title: 'Ethereum', value: 1 },
  { title: 'Monero',   value: 2 },
  { title: 'Zcash',    value: 3 },
  { title: 'Polkadot', value: 4 },
]);
```

**Vote shape:** `Vote([rank0, rank1, rank2, rank3, rank4])` where `rank_i` is the rank you give option `i`, all distinct, in `0..(choices.length - 1)`.

If the user prefers Ethereum first, Zcash second, etc., they need to invert: "I want option 1 (Ethereum) to get rank 0; option 3 (Zcash) to get rank 1" → `Vote([_, 0, _, 1, _])`. UIs typically handle this conversion before calling `submitVote`.

## Auto-results-type metadata

Each variant sets `resultsType.name` in the published election metadata, so downstream readers can render results correctly:

| Variant          | `resultsType.name`              |
| ---------------- | ------------------------------- |
| Base Election    | `'single-choice-multiquestion'` |
| Approval         | `'approval'`                    |
| MultiChoice      | `'multiple-choice'`             |
| Budget           | `'budget-based'`                |
| Quadratic        | `'quadratic'`                   |

Voters/UIs read this from `publishedElection.resultsType` after fetching.

## Validation that runs at vote time

`PublishedElection.checkVote(vote)` (called inside `submitVote`) throws if:

- Vote length doesn't match the election's `maxCount`.
- A value exceeds `maxValue`.
- Approval: any value is neither 0 nor 1.
- MultiChoice: count is outside `[min, max]` or duplicates exist when `uniqueChoices` enforced.
- Budget / Quadratic: total cost exceeds `maxTotalCost` (or doesn't equal it when `forceFullBudget`).
- Ranked: duplicates when `uniqueChoices = true`.

Trigger validation locally before submission with `publishedElection.checkVote(vote)` — see `voting.md`.

## Cross-references

- `elections.md` — the base flow these variants build on.
- `voting.md` — `Vote` shape and submission.
- `recipes/approval-vote.ts`, `recipes/quadratic-vote.ts`, `recipes/ranked-vote.ts`, `recipes/multichoice-vote.ts` — copy-pasteable end-to-end examples.
