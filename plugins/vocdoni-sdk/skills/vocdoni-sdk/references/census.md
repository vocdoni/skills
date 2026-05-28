# `references/census.md` — Census types and publishing

Companion to the [[vocdoni-sdk]] skill. Use this when deciding which census class to use for a given election, how to add voters, how publishing works, or how `CspCensus` (blind-signature gate) and `PublishedCensus` (re-use of an existing census) fit in.

For token-holder censuses (ERC20/ERC721 from real chains), see `census3.md` — those produce `TokenCensus`/`StrategyCensus`, which extend `PublishedCensus` and plug into elections the same way.

## Census types and when to use each

| Census class       | Where it comes from              | Use it when…                                                                                       |
| ------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `PlainCensus`      | Built locally, weight = 1        | A simple list of eligible voters where every vote counts equally.                                  |
| `WeightedCensus`   | Built locally, custom weights    | Voters have different stakes (token balances, shares, credits for quadratic/budget elections).     |
| `CspCensus`        | Reference to a CSP service       | Identity is gated by an external authority via blind signatures (KYC, allowlist, anti-Sybil API).  |
| `PublishedCensus`  | Reference to an already-published census | Re-using a census you previously published, or one published by another tool.                       |
| `TokenCensus`      | Census3 (from `census3.md`)      | Holders of a single ERC20/ERC721 on a real chain.                                                  |
| `StrategyCensus`   | Census3 (from `census3.md`)      | Multi-token predicate (`(A OR B) AND C`), with optional `minBalance` per token.                    |

The first three are common; pick by election shape.

## `CensusType` enum

Internally the SDK distinguishes by `CensusType`:

```ts
enum CensusType {
  WEIGHTED  = 'weighted',    // off-chain merkle (PlainCensus, WeightedCensus, TokenCensus non-anon, StrategyCensus non-anon)
  ANONYMOUS = 'zkweighted',  // off-chain merkle + ZK proofs (anonymous voting)
  CSP       = 'csp',         // CspCensus
  UNKNOWN   = 'unknown',
}
```

You set this implicitly by picking a census class — you don't usually pass it yourself.

## `PlainCensus` — simple list

```ts
import { PlainCensus } from '@vocdoni/sdk';

const census = new PlainCensus();
census.add('0x1234…');                    // single address
census.add(['0x5678…', '0x9abc…']);       // array
census.remove('0x1234…');
```

- Every voter has weight `1`.
- Addresses must be valid Ethereum addresses (ethers `isAddress`).
- Duplicates are deduplicated automatically (last add wins).

Use this for: vanilla yes/no polls, multi-question surveys, approval voting where weights don't matter.

## `WeightedCensus` — custom weights

```ts
import { WeightedCensus } from '@vocdoni/sdk';

const census = new WeightedCensus();
census.add({ key: '0x1234…', weight: BigInt(100) });
census.add([
  { key: '0x5678…', weight: BigInt(50) },
  { key: '0x9abc…', weight: BigInt(75) },
]);
```

`ICensusParticipant`:

```ts
type ICensusParticipant = {
  key: string;       // 0x-prefixed Ethereum address
  weight: bigint;    // voting power; bigint is required (NOT number)
};
```

When you use this with `voteType.costFromWeight = true` (quadratic/budget elections), the weight becomes the voter's **credit budget** for that election. Otherwise it's a straight vote multiplier.

## `CspCensus` — blind-signature gated

```ts
import { CspCensus } from '@vocdoni/sdk';

const census = new CspCensus(
  '0x04a1…',                       // CSP public key (hex, 0x optional)
  'https://csp.example.com/v1',    // CSP base URL (must be a valid URL)
);
```

There's no `.add()` — there's no participant list locally. The CSP authority decides who can vote at vote time. See `csp.md` for the full voting flow (it has multi-step auth with the CSP server).

## `PublishedCensus` — reference an existing census

If a census was already created (by you in a previous run, or by another tool), reference it without rebuilding:

```ts
import { CensusType, PublishedCensus } from '@vocdoni/sdk';

const census = new PublishedCensus(
  '<merkle root, hex>',            // censusId
  '<ipfs:// uri>',                  // censusURI
  CensusType.WEIGHTED,              // or ANONYMOUS, CSP
  /* size?  */ 1234,
  /* weight? */ BigInt('1000000'),
);
```

## Publishing an off-chain census

`PlainCensus` and `WeightedCensus` are local objects. The merkle tree gets generated and published when you pass them into `client.createElection(election)` — the SDK takes care of:

1. Creating a server-side census.
2. Adding participants in chunks (default 8192/req — tunable via the client's `census` option).
3. Publishing (default async — the SDK polls until ready).
4. Filling in `census.censusId`, `census.censusURI`, `census.size`, `census.weight` on your in-memory object.

You almost never call publishing methods directly. If you want to publish a census *without* attaching it to an election (e.g. to reuse across many elections), use `client.censusService`:

```ts
await client.censusService.createCensus(census);
// census.censusId / censusURI / size / weight are now populated
```

After that, future elections can use:

```ts
const sharedCensus = new PublishedCensus(census.censusId, census.censusURI, census.type, census.size, census.weight);
const election = Election.from({ census: sharedCensus, /* … */ });
```

## Fetching census info or proofs

Once a census is published, you can read it back:

```ts
const info = await client.censusService.get(censusId);
// { size: number, weight: bigint, type: CensusType }

const proof = await client.censusService.fetchProof(censusId, voterAddress);
// { type, weight, root, proof, value, siblings? }
```

`fetchProof` throws if the voter is not in the census — useful to validate eligibility before showing a vote UI (the high-level `client.isInCensus()` wraps this with friendlier semantics; see `voting.md`).

## Gotchas

- **Addresses must be valid Ethereum addresses.** The SDK calls `isAddress()`. Comparison is case-insensitive internally; both `0xAbCd…` and `0xabcd…` work.
- **Weights are `bigint`.** Don't pass `Number`. Use `BigInt(123)` or `123n`.
- **Census must be published before the election is created.** `client.createElection()` handles this automatically for local `PlainCensus` / `WeightedCensus`. If you instantiate a `PublishedCensus` with a wrong root/URI, election creation will succeed but voting will fail (no proof generatable).
- **Census class ↔ election type pairing.** Anonymous elections (`electionType.anonymous = true`) need an anonymous-type census (built the same way but published as `ANONYMOUS`; see `anonymous.md`). CSP elections need `CspCensus`. Mixing them produces opaque errors at vote time.
- **Dynamic census.** If you set `electionType.dynamicCensus = true` you can add voters after election creation via `client.changeElectionCensus(electionId, censusId, censusURI, maxCensusSize?)`. Otherwise the census is locked at creation.
- **`maxCensusSize`.** On the election you may set `maxCensusSize` to cap eligible voters; it must be ≥ actual census size at creation. Setting it lets you later add voters up to that cap with `client.changeElectionMaxCensusSize(...)`.

## Cross-references

- `elections.md` — how a census is passed into `Election.from({ census })`.
- `voting.md` — `client.isInCensus()`, vote submission proof generation.
- `anonymous.md` — how anonymous censuses differ.
- `csp.md` — full CSP flow.
- `census3.md` — token-holder censuses producing `TokenCensus`/`StrategyCensus`.
