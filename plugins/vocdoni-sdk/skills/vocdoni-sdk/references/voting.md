# `references/voting.md` — Casting votes

Companion to the [[vocdoni-sdk]] skill. Use this when submitting a vote, validating eligibility, or constructing one of the `Vote` subclasses.

## The minimal flow

```ts
import { Vote } from '@vocdoni/sdk';

// The client must have a wallet that is the voter (not the creator), and an election ID set.
client.wallet = voterWallet;
client.setElectionId(electionId);

const vote = new Vote([0]); // see "Vote shape" below
const voteId = await client.submitVote(vote);

console.log(`${client.explorerUrl}/verify/#/${voteId}`);
```

`submitVote` returns the vote ID (also known as the nullifier on anonymous elections). You can hand it to the voter to look up their receipt.

## Vote shape

The argument to `new Vote([...])` depends on the election shape (see `elections.md` and `election-types.md`). Quick recap:

| Election kind                       | Array length                     | Each entry                                                                  |
| ----------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| Base — N questions, single choice each | N (one per question)             | The chosen choice's `value` (set in `addQuestion`; defaults to its index)  |
| Approval                            | number of options                | `0` (reject) or `1` (approve)                                               |
| MultiChoice                         | between `min` and `max`          | choice value, or an abstain marker                                          |
| Budget                              | number of options                | credits allocated to option                                                 |
| Quadratic                           | number of options                | credits allocated to option (cost = value^quadraticCost)                    |
| Ranked                              | number of options                | rank (`0..N-1`), all distinct                                               |

If you're using a variant election, **call `publishedElection.checkVote(vote)`** before submitting — it throws on a bad shape with a helpful message:

```ts
const e = await client.fetchElection(electionId);
try {
  e.checkVote(vote);
} catch (err) {
  // bad ballot shape; show user a clear error before paying for the tx
}
```

## The voter must be in the census

Before voting, sanity-check eligibility:

```ts
const inCensus = await client.isInCensus();    // uses client.wallet + client.electionId
if (!inCensus) {
  // show "you're not eligible"
}
```

`isInCensus()` accepts an options object to override:

```ts
await client.isInCensus({ wallet: someOtherWallet, electionId: someOtherId });
```

## Did they already vote?

```ts
const previousVoteId = await client.hasAlreadyVoted();
// returns the vote ID (string) if they voted, or null otherwise
```

For anonymous elections, you must pass `voteId` (the SDK can't derive it deterministically):

```ts
await client.hasAlreadyVoted({ voteId: '<known vote id>' });
```

## How many times can they still vote?

If the election allows overwrites (`voteType.maxVoteOverwrites > 0`), each address can resubmit up to that many additional times. To check:

```ts
const remaining = await client.votesLeftCount();
// 0 = used up; > 0 = still can vote/overwrite

const canVote = await client.isAbleToVote(); // sugar: votesLeftCount() > 0
```

For anonymous elections, again pass `voteId`.

## `submitVote` — step-by-step

When you need progress (UI spinners, telemetry), use the async-generator variant:

```ts
for await (const step of client.submitVoteSteps(vote)) {
  switch (step.key) {
    case 'get-election':  /* fetched election metadata */ break;
    case 'get-proof':     /* census proof fetched */ break;
    case 'get-signature': /* CSP/anon signature obtained */ break;
    case 'calc-zk-proof': /* ZK proof generated (anonymous only) */ break;
    case 'generate-tx':   /* tx built */ break;
    case 'sign-tx':       /* tx signed */ break;
    case 'done':          console.log('voteId', step.voteId); break;
  }
}
```

## Vote variants

### `Vote` — standard ballot

```ts
new Vote(votes: Array<number | bigint>);
```

For all non-anonymous, non-CSP elections.

### `AnonymousVote` — anonymous (ZK) ballot

```ts
import { AnonymousVote } from '@vocdoni/sdk';

const vote = new AnonymousVote(
  [0],          // votes
  undefined,    // signature — optional; SDK can generate from client.wallet
  'mypassword', // password used to derive the SIK; default '0'
);
```

The full anonymous flow (SIK registration, circuit fetching) is in `anonymous.md`.

### `CspVote` — blind-signature ballot

```ts
import { CspVote } from '@vocdoni/sdk';

const vote = new CspVote(
  [0],                       // votes
  unblindedCspSignature,     // required
  CspProofType.ECDSA_BLIND,  // optional; defaults vary
  /* weight? */ BigInt(1),
);
```

The full CSP flow is in `csp.md`.

`submitVote` accepts all three subclasses transparently — it dispatches to the right proof generator based on the election's census type.

## Defaulting to the client's stored state

These all use `client.wallet` and `client.electionId` if not passed explicitly:

```ts
client.isInCensus()
client.hasAlreadyVoted()
client.votesLeftCount()
client.isAbleToVote()
client.submitVote(vote)
client.fetchElection()      // when no id given
```

If you call them without setting `electionId` (and without an `electionId` option), they throw `"No election set"`.

## Pattern: vote with a different wallet on the same client

```ts
const client = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: creator });
await client.createAccount();
// … create election …
client.setElectionId(electionId);

// Now vote as someone else without spinning up a new client
client.wallet = voterWallet;
await client.submitVote(new Vote([0]));
```

This is the pattern most recipes use to avoid plumbing through multiple clients.

## Pattern: many concurrent voters

Spin up one client per voter (cheap):

```ts
import { Wallet } from '@ethersproject/wallet';
import { EnvOptions, VocdoniSDKClient, Vote } from '@vocdoni/sdk';

await Promise.all(voters.map((voter) => {
  const c = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: voter, electionId });
  return c.submitVote(new Vote([Math.round(Math.random())]));
}));
```

Each `submitVote` fetches its own proof and signs independently; no shared state needed.

## Common errors

| Error message                                            | Cause                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `No wallet set`                                          | `client.wallet` is null; assign it or pass `{ wallet }` in options.                |
| `No election set`                                        | `client.electionId` is null; call `setElectionId(id)` or pass `{ electionId }`.    |
| `Time out waiting for transaction: …`                    | TX wasn't confirmed within `tx_wait`. Bump `attempts` or retry.                    |
| `Account is not in census`                               | The voter's address isn't registered in the published census.                       |
| `Vote already submitted` (or similar)                    | `maxVoteOverwrites` exhausted; check `votesLeftCount` first.                       |
| `Invalid vote`                                           | Vote shape doesn't satisfy `checkVote`; see `election-types.md` for the constraints. |

## Cross-references

- `elections.md` and `election-types.md` — vote shape per election kind.
- `results.md` — read back vote counts, status.
- `anonymous.md`, `csp.md` — specialised flows for `AnonymousVote` and `CspVote`.
