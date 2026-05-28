# `references/elections.md` — Creating elections (base flow)

Companion to the [[vocdoni-sdk]] skill. Use this when constructing an `Election` for the most common case (one or many questions, single choice per question). For *variant* election shapes — approval, multichoice, budget, quadratic — read `election-types.md` after this.

## The shape

```ts
import { Election } from '@vocdoni/sdk';

const election = Election.from({
  title: 'Election title',
  description: 'Election description',
  endDate: new Date(Date.now() + 60 * 60 * 1000), // required
  census, // a Census subclass (see census.md)
});

election.addQuestion('Question 1', 'Description 1', [
  { title: 'Yes', value: 0 },
  { title: 'No',  value: 1 },
]);
// chainable
election.addQuestion('Question 2', 'Description 2', [
  { title: 'A', value: 0 },
  { title: 'B', value: 1 },
  { title: 'C', value: 2 },
]);

const electionId = await client.createElection(election);
client.setElectionId(electionId);
```

That's the smallest viable election. Everything else (lifecycle, variants, costs) is layered on top.

## `Election.from()` parameters — full reference

```ts
type IElectionParameters = {
  // Required
  title: string | MultiLanguage<string>;
  endDate: string | number | Date;
  census: Census;

  // Optional, sensible defaults
  description?: string | MultiLanguage<string>;
  header?: string;                 // URL to header image
  streamUri?: string;              // URL to live video stream
  startDate?: string | number | Date; // omit → starts immediately when the chain confirms
  meta?: CustomMeta;               // arbitrary JSON; do NOT use the key 'sdk' (reserved)
  electionType?: IElectionType;
  voteType?: IVoteType;
  questions?: IQuestion[];         // can also be added via .addQuestion()
  maxCensusSize?: number;          // cap on eligible voters; must be > 0
  temporarySecretIdentity?: boolean; // remove SIK after election ends; default false
  addSDKVersion?: boolean;         // embed SDK version in meta; default true
};
```

`MultiLanguage<T>` is `{ default: T; [lang: string]: T }`. A plain string is auto-converted to `{ default: value }`.

## `IElectionType` — operational mode

```ts
type IElectionType = {
  interruptible?: boolean;     // default true — election can be paused/ended manually
  dynamicCensus?: boolean;     // default false — true allows changeElectionCensus() after creation
  secretUntilTheEnd?: boolean; // default false — true encrypts individual votes until the end block; live results hidden
  anonymous?: boolean;         // default false — true enables ZK voting (see anonymous.md)
  metadata?: {
    encrypted?: boolean;       // default false — encrypts questions/descriptions
    password?: string | null;  // required if encrypted = true
  };
};
```

**Important:** `metadata.encrypted` (hides questions until decrypted with the password) is *orthogonal* to `secretUntilTheEnd` (hides individual ballots). Either, both, or neither can be true.

## `IVoteType` — ballot semantics

```ts
type IVoteType = {
  uniqueChoices?: boolean;     // default false — a voter cannot pick the same choice twice
  maxVoteOverwrites?: number;  // default 0 — N additional times the voter can change their vote
  costFromWeight?: boolean;    // default false — use census weight as budget (for quadratic/budget)
  costExponent?: number;       // default 1 — applied per-choice to compute total cost; 2 for quadratic
  maxValue?: number | null;    // default max(choices.length - 1); upper bound per ballot field
  maxCount?: number | null;    // default questions.length; number of ballot fields
  maxTotalCost?: number | null; // default 0 (no cap); ceiling on Σ(value[i]^costExponent)
};
```

For the variants (approval / multichoice / budget / quadratic) you don't usually set `IVoteType` yourself — the variant class fills it in. Set these only for the base `Election` with custom rules.

## Questions and choices

```ts
election.addQuestion(
  title: string | MultiLanguage<string>,
  description: string | MultiLanguage<string>,
  choices: Array<{ title: string; value?: number; meta?: CustomMeta }>,
  meta?: CustomMeta,           // optional per-question meta
): UnpublishedElection         // chainable
```

- `title` and `description` accept the same string-or-multilang shape as the election fields.
- Each choice has a `title` and a numeric `value`. If `value` is omitted, the SDK assigns its array index. **Voters reference choices by `value`, not by index.** With `value: 0` for "Yes" and `value: 1` for "No", a `Vote([0])` votes Yes.
- Per-question and per-choice `meta` is arbitrary JSON (e.g. `{ image: 'https://…' }`).

Multi-question elections: each ballot is `Vote([choice_for_q1, choice_for_q2, …])`.

`election.removeQuestion(index)` drops a question.

## Estimate or compute the price

```ts
const estimate = await client.estimateElectionCost(election); // fast, approximate
const exact    = await client.calculateElectionCost(election); // precise; calls chain
```

Both require the election to be a valid `UnpublishedElection` (census set, etc.). Numbers are in Vocdoni tokens — the account needs ≥ this much balance to create the election. Throws if `maxCensusSize` is not set on some elections; safest to set it.

## Create

```ts
const electionId = await client.createElection(election);
client.setElectionId(electionId);
```

`createElection`:

1. Publishes the census if it isn't already.
2. Pins metadata to IPFS and computes the CID.
3. Builds the new-process transaction with the creator's nonce.
4. Signs with `client.wallet`.
5. Submits and waits for confirmation (`tx_wait` controls polling).
6. Returns the 64-hex-char election ID.

If you want progress notifications mid-flow (UI), use:

```ts
for await (const step of client.createElectionSteps(election)) {
  switch (step.key) {
    case 'get-chain-data':   /* … */ break;
    case 'census-created':   /* … */ break;
    case 'get-account-data': /* … */ break;
    case 'get-data-pin':     /* IPFS pin done */ break;
    case 'generate-tx':      /* tx built */ break;
    case 'sign-tx':          /* tx signed */ break;
    case 'creating':         console.log('tx', step.txHash); break;
    case 'done':             console.log('electionId', step.electionId); break;
  }
}
```

## After creation: wait for the election to be ready

`createElection()` resolves once the chain has accepted the transaction, but voting isn't possible until the next blocks have been produced and the election is `ONGOING`. Poll:

```ts
import { ElectionStatus } from '@vocdoni/sdk';

const waitForElectionReady = async (id: string) => {
  while (true) {
    const e = await client.fetchElection(id);
    if (e.status === ElectionStatus.ONGOING) return;
    await new Promise((r) => setTimeout(r, 5000));
  }
};
```

Block time on the vochain is ~10–13 s, so plan on ~15–30 s before first vote.

## Lifecycle: pause / cancel / end / continue

```ts
await client.pauseElection(id);    // suspends; later continueElection resumes
await client.continueElection(id); // brings it back ONGOING
await client.endElection(id);      // ends manually; results finalize
await client.cancelElection(id);   // discards the election
```

All require `electionType.interruptible = true` at creation (the default). After `end` or `cancel`, the election cannot be revived.

## Mutate a live election (only if allowed)

These only work if the matching `electionType` flag is set:

```ts
// Requires electionType.dynamicCensus = true
await client.changeElectionCensus(id, newCensusId, newCensusURI, maxCensusSize?);

// Always supported if interruptible
await client.changeElectionMaxCensusSize(id, newMax);
await client.changeElectionDuration(id, durationInSeconds);
await client.changeElectionEndDate(id, newEndDateOrTimestamp);
```

## `ElectionStatus` enum

```ts
enum ElectionStatus {
  PROCESS_UNKNOWN = 'PROCESS_UNKNOWN',
  UPCOMING        = 'UPCOMING',    // startDate > now and chain marked READY
  ONGOING         = 'ONGOING',     // startDate <= now, accepting votes
  ENDED           = 'ENDED',
  CANCELED        = 'CANCELED',
  PAUSED          = 'PAUSED',
  RESULTS         = 'RESULTS',     // ended and final results are published
}
```

Voting is only possible while `ONGOING`. Reading results works on `ONGOING`, `ENDED`, and `RESULTS` (subject to `secretUntilTheEnd` constraints).

## Gotchas

- **`endDate` is required.** Omitting it throws.
- **`startDate` clamped to "immediate" if too close.** If you set a `startDate` less than ~50 s in the future, the SDK rounds to "starts immediately" so the vochain doesn't reject it as already past.
- **The `meta.sdk` key is reserved.** Setting it throws. The SDK auto-embeds its own version under that key unless `addSDKVersion: false`.
- **Multi-question elections use `Vote([…])`** with one entry per question. The order is the order in which you called `addQuestion`.
- **Variant elections (approval/multichoice/budget/quadratic) only support one question.** Calling `addQuestion` a second time throws. See `election-types.md`.
- **Election creation costs tokens.** Use `estimateElectionCost` to see roughly how many; the price depends on `maxCensusSize`, duration, `secretUntilTheEnd`, `anonymous`, and `maxVoteOverwrites`.
- **Setting `maxCensusSize` is strongly recommended** even for small censuses — it makes cost calculation deterministic and unblocks `changeElectionMaxCensusSize` later.

## Cross-references

- `client.md` — environment, signer.
- `accounts.md` — creator must have a registered, funded account.
- `census.md` — every election needs one.
- `election-types.md` — approval, multichoice, budget, quadratic, ranked.
- `voting.md` — how voters submit, with the `Vote` class.
- `results.md` — how `fetchElection(id)` returns results and metadata.
- `anonymous.md`, `csp.md` — specialised election types.
