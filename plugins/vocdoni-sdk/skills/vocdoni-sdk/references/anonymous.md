# `references/anonymous.md` — Anonymous (ZK) voting

Companion to the [[vocdoni-sdk]] skill. Use this when the election should hide *who voted for what* using zero-knowledge proofs. Read `voting.md` and `census.md` first for the baseline; this builds on both.

## When to use anonymous voting

The voter's identity is hidden even from the chain. Useful for:

- Confidential governance ballots where stakeholder identities are sensitive.
- Whistleblower polls.
- Any case where coercion-resistance is more important than auditing per-voter votes.

Trade-offs: extra setup per voter (SIK signature, ZK proof generation), heavier client-side compute (Groth16 prover via WASM), slightly higher election creation cost.

## How it works (intuition)

- Voters publish a one-time **Secret Identity Key (SIK)** to the chain, derived from `(address, signature, password)`. The address ↔ SIK link is not derivable without the signature.
- The census is a merkle tree of *(address, weight)* pairs, just like a `WeightedCensus`, but published with `CensusType.ANONYMOUS`.
- When voting, the voter produces a **ZK proof** that:
  - "I know a SIK in the SIK tree and an address in the census tree with weight ≥ what I'm spending."
  - "My nullifier matches `Poseidon(signature, password, electionId)`" — so the chain can detect double-voting without learning the address.
- The chain verifies the proof and accepts the vote without learning the voter.

The SDK abstracts most of this. You as the agent:

1. Mark the election anonymous.
2. Build an anonymous census (same code as `WeightedCensus`, the census service picks the type).
3. Ensure each voter has a SIK registered (call once per voter per password).
4. Submit `AnonymousVote` instead of `Vote`.

## Creating an anonymous election

```ts
import { Election, EnvOptions, VocdoniSDKClient, WeightedCensus } from '@vocdoni/sdk';

const census = new WeightedCensus();
for (const voter of voters) {
  census.add({ key: voter.address, weight: BigInt(1) });
}

const election = Election.from({
  title: 'Secret ballot',
  endDate: new Date(Date.now() + 24 * 3600 * 1000),
  census,
  electionType: {
    anonymous: true,
  },
});

election.addQuestion('Yes or no?', '', [
  { title: 'Yes', value: 0 },
  { title: 'No',  value: 1 },
]);

const electionId = await client.createElection(election);
```

The election creation logic picks the right `CensusType.ANONYMOUS` automatically when `electionType.anonymous` is set.

## Voter setup: registering the SIK

Each voter needs a Secret Identity Key on chain *before* their first anonymous vote. The SDK does this implicitly during `createAccount`:

```ts
// As the voter:
const voterClient = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: voterWallet });
await voterClient.createAccount({
  sik: true,                 // default true; explicit for clarity
  password: 'optional-pwd',  // default '0'
});
```

If you want to check whether a SIK already exists for a given (address, signature, password):

```ts
const signature = await client.anonymousService.signSIKPayload(voterWallet);
const exists = await client.anonymousService.hasRegisteredSIK(
  voterWallet.address,
  signature,
  'optional-pwd', // same one used at registration
);
```

The signed payload (`signSIKPayload`) is constant text:

> `This signature request is used to create your own secret identity key...`

Same wallet + same password → same SIK. Same wallet + different password → different SIK. Voters using a single password are effectively a single identity across elections; voters using a unique per-election password get election-specific identities.

## Casting an anonymous vote

```ts
import { AnonymousVote } from '@vocdoni/sdk';

// As the voter
const voterClient = new VocdoniSDKClient({
  env: EnvOptions.STG,
  wallet: voterWallet,
  electionId,
});

const vote = new AnonymousVote(
  [0],          // ballot — same shape rules as base Vote
  undefined,    // signature — let the SDK derive from client.wallet
  'optional-pwd', // must match the one used at SIK registration
);

const voteId = await voterClient.submitVote(vote);
```

Internally `submitVote` will:

1. Sign the SIK payload (or use the provided `signature`).
2. Fetch the voter's census proof + SIK proof.
3. Compute a nullifier and prepare circuit inputs.
4. Generate a Groth16 ZK proof (downloads the circuit on first use).
5. Submit the encoded transaction.

If you want to see progress (proof generation can take a couple of seconds), use `submitVoteSteps` — the `'calc-zk-proof'` step is the heavy one.

## Vote IDs are not deterministic

For regular elections, the vote ID equals `keccak256(address || electionId)` so the SDK can recompute it. For anonymous, the nullifier comes from `(signature, password, electionId)`, and the SDK needs the *signature* to recompute — which it doesn't keep across sessions.

This means `hasAlreadyVoted` / `votesLeftCount` / `isAbleToVote` **must receive `voteId`** explicitly when called against an anonymous election:

```ts
await client.hasAlreadyVoted({ voteId: '<the vote id you got from submitVote>' });
```

Save the vote ID at submission time if you want to let voters check status later.

## Circuits

ZK voting uses public proving/verifying keys (Groth16) and a WASM circuit. The SDK fetches them from the chain on first use and verifies their hashes match what the chain expects:

```ts
const circuits = await client.anonymousService.fetchCircuits();
// Object containing: zKeyData, zKeyHash, zKeyURI, vKeyData, vKeyHash, vKeyURI, wasmData, wasmHash, wasmURI
```

You almost never call this directly — first vote triggers it. If you want to ship the circuits with your bundle (avoid first-vote latency), pass them via `client.anonymousService.setCircuits(precomputedCircuits)`.

## `AnonymousVote` reference

```ts
class AnonymousVote extends Vote {
  constructor(
    votes: Array<number | bigint>,
    signature?: string, // optional; SDK derives via signSIKPayload(client.wallet) if absent
    password?: string,  // default '0'
  );
  signature?: string;
  password?: string;
}
```

## Encrypted-until-end + anonymous

Both can be on:

```ts
electionType: {
  anonymous: true,
  secretUntilTheEnd: true,
}
```

Then votes are ballot-encrypted *and* identity-hidden — even live tallies are hidden until the election ends.

## Pitfalls

- **Password discipline matters.** A voter who uses a different password than at SIK registration gets `"hasRegisteredSIK = false"` and can't vote.
- **Anonymous census ≠ anonymous election.** `electionType.anonymous = true` tells the SDK to publish the census as `ANONYMOUS` — but if you reuse a pre-published `PublishedCensus` of type `WEIGHTED`, voting will fail. Either build the census in the same flow as the election, or ensure the existing census was published as `ANONYMOUS`.
- **First vote downloads ~MBs of circuit data.** Pre-fetch in production frontends.
- **Vote ID is the nullifier.** Save it; voters can't look it up later otherwise.

## Cross-references

- `elections.md` — base election creation (set `electionType.anonymous`).
- `census.md` — `WeightedCensus` is what backs anonymous elections; publishing produces `CensusType.ANONYMOUS` when the election is anonymous.
- `voting.md` — `submitVote` accepts `AnonymousVote` directly.
- `recipes/anonymous-vote.ts` — runnable end-to-end example.
