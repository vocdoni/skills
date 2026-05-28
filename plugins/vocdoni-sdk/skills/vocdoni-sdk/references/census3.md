# `references/census3.md` — Census3 (token-holder censuses)

Companion to the [[vocdoni-sdk]] skill. Use this when the user wants a census derived from on-chain token holdings — ERC20, ERC721, multi-token predicates ("(A OR B) AND C"), or any case involving `VocdoniCensus3Client`.

## What Census3 is

[Census3](https://github.com/vocdoni/census3) is a separate Vocdoni service that:

- Indexes token-holder balances for tracked tokens on supported chains (Ethereum, Polygon, etc.).
- Lets you define **strategies** — boolean predicates over tokens with optional minimum-balance requirements.
- Produces a Vocdoni-compatible **merkle census** of the holders matching a strategy, with their balances as voting weights.

It's exposed via `VocdoniCensus3Client` from the same `@vocdoni/sdk` npm package. The censuses it produces (`TokenCensus`, `StrategyCensus`) plug directly into a normal `Election` via `Election.from({ census, … })`.

## Client setup

```ts
import { EnvOptions, VocdoniCensus3Client } from '@vocdoni/sdk';

const census3 = new VocdoniCensus3Client({
  env: EnvOptions.PROD,  // DEV / STG / PROD; default API URLs match
});
```

Constructor options:

```ts
type Census3ClientOptions = {
  env: EnvOptions;                          // required
  api_url?: string;                         // override default
  tx_wait?: { retry_time?: number; attempts?: number }; // queue polling; default { 2000, 10 }
};
```

Default API URLs:

| Env  | URL                                       |
| ---- | ----------------------------------------- |
| DEV  | `https://census3-dev.vocdoni.net/api`     |
| STG  | `https://census3-stg.vocdoni.net/api`     |
| PROD | `https://census3.vocdoni.io/api`          |

## Discovery: what's supported

```ts
await census3.getSupportedChains();
// [{ chainID: 1, shortName: 'eth', name: 'Ethereum Mainnet' }, …]

await census3.getSupportedTypes();
// ['erc20', 'erc721', 'erc777', 'erc1155', 'poap', 'nation3', 'want', 'erc721burned', 'unknown']

await census3.getSupportedOperators();
// [{ tag: 'AND', description: '…' }, { tag: 'OR', … }, { tag: 'AND:sum', … }, { tag: 'AND:mul', … }, …]
```

## Tokens

### List all tracked tokens

```ts
const tokens = await census3.getSupportedTokens(); // TokenSummary[]
// Each: { ID, name, type, chainID, symbol, decimals, totalSupply, defaultStrategy, tags, iconURI? }
```

### Get one token

```ts
const token = await census3.getToken(
  '0x0AaCfbeC6a24756c20D41914F2caba817C0d8521', // address
  1,                                              // chainID
  /* externalId? */ '',
);
// {
//   ID, name, type, chainID, chainAddress, startBlock, symbol, decimals,
//   totalSupply, defaultStrategy, tags, iconURI?, externalID?,
//   status: { synced, atBlock, progress },
//   size,  // number of holders
// }
```

Check `token.status.synced` before creating a token census from it — see "Pitfalls".

### Register a new token to track

```ts
await census3.createToken(
  '0xMyNewToken',
  'erc20',
  /* chainID */ 1,
  /* externalId? */ '',
  /* tags? */ [],
);
```

The service then starts indexing holders asynchronously; it can take minutes/hours depending on contract age. Poll `getToken(...).status.synced` to know when it's ready.

### Holder queries

```ts
await census3.isHolderInToken(tokenId, chainId, holderAddress, externalId?);  // boolean
await census3.tokenHolderBalance(tokenId, chainId, holderAddress, externalId?); // bigint
```

## Strategies

A **strategy** is a named predicate over one or more tokens. Strategies are the unit of census creation when you want anything more interesting than "single-token holders."

### List, fetch

```ts
await census3.getStrategies();
// [{ ID, alias, predicate, uri, tokens: { [name]: { ID, chainID, chainAddress, minBalance?, … } } }, …]

await census3.getStrategy(19);
await census3.getStrategiesByToken('0xToken', 1);
```

### Create a strategy

```ts
const id = await census3.createStrategy(
  'My governance strategy',           // alias
  '(wANT OR ANT) AND USDC',           // predicate over symbols
  {
    wANT: { ID: '0xWANT…', chainID: 1, minBalance: '10000' },
    ANT:  { ID: '0xANT…',  chainID: 5 },
    USDC: { ID: '0xUSDC…', chainID: 1, minBalance: '50' },
  },
);
// id: number — the new strategy ID
```

The keys in the `tokens` object are *predicate aliases* — they appear in the predicate string by name. The `ID` field is the contract address.

### Predicate syntax

| Operator   | Behaviour                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `AND`      | Holder must satisfy each side's `minBalance` (weight set to a fixed 1).                         |
| `OR`       | Holder must satisfy at least one side's `minBalance`.                                           |
| `AND:sum`  | Sum of token balances must satisfy threshold; weight = sum of balances.                          |
| `AND:mul`  | Product of token balances must satisfy threshold; weight = product of balances.                  |

Examples:

```
TOKENA                              // single-token strategy (just a literal)
TOKENA AND TOKENB                   // intersection
(TOKENA OR TOKENB) AND TOKENC       // grouped
TOKENA AND:sum TOKENB               // weighted by sum of A + B balances
```

Use `validatePredicate(predicate)` to see the parsed tree before saving a strategy:

```ts
const parsed = await census3.validatePredicate('(YAM OR API3) AND 1INCH');
// { result: { childs: { operator: 'AND', tokens: [ … ] } } }
```

### Estimate before you commit

Building a census for a large strategy can take minutes. Estimate first:

```ts
await census3.getStrategyEstimation(strategyId);
// { size: 5516, timeToCreateCensus: 3296 /* ms */, accuracy: 100 /* for anonymous */ }

// Or for a not-yet-created predicate
await census3.getPredicateEstimation(predicate, tokens, /* anonymous? */ false);
```

### Import a strategy from IPFS

```ts
const strategy = await census3.importStrategy('bafy…cid');
// Returns the full Strategy object after the service materialises it.
```

### Inspect the holder set

```ts
const holders = await census3.getStrategyHolders(strategyId);
// [{ holder: '0xabc…', weight: 100n }, … ]
```

This is long-running (queue-polled).

## Censuses

Census3 censuses are immutable snapshots — each `createCensus*` call produces a new census ID and merkle root.

### List / get

```ts
await census3.getCensuses(strategyId);
// [{ ID, strategyID, merkleRoot, uri, size, weight, anonymous, accuracy }, …]

await census3.getCensus(censusId);
```

### Create from a strategy

```ts
const c = await census3.createCensus(strategyId, /* anonymous? */ false);
// Census3Census: { ID, strategyID, merkleRoot, uri, size, weight, anonymous, accuracy }
```

### Create a `TokenCensus` from a single token (uses the token's default strategy)

```ts
import { TokenCensus } from '@vocdoni/sdk';

const tokenCensus: TokenCensus = await census3.createTokenCensus(
  '0xMyTokenAddress',
  /* chainID */ 1,
  /* anonymous? */ false,
  /* externalId? */ '',
);
// Throws "Token is not yet synced" if status.synced is false.
```

`TokenCensus` extends `PublishedCensus`. The relevant properties for plugging into an election:

| Property      | Source                  | Used for                                  |
| ------------- | ----------------------- | ----------------------------------------- |
| `censusId`    | `merkleRoot`            | Merkle root for proof verification.        |
| `censusURI`   | `uri`                   | IPFS URI of merkle tree.                  |
| `type`        | `WEIGHTED` or `ANONYMOUS` | Election census-type binding.             |
| `size`        | Holder count            | `maxCensusSize` upper bound.              |
| `weight`      | Sum of balances         | Total voting power.                        |
| `token`       | Full `Token` object     | Embedded into `election.meta` for tools.   |

### Create a `StrategyCensus` from a strategy

```ts
import { StrategyCensus } from '@vocdoni/sdk';

const strategyCensus: StrategyCensus = await census3.createStrategyCensus(
  strategyId,
  /* anonymous? */ false,
);
// Same shape as TokenCensus, with .strategy instead of .token.
```

## Plug Census3 into a Vocdoni election

```ts
import { Election, EnvOptions, VocdoniCensus3Client, VocdoniSDKClient } from '@vocdoni/sdk';
import { Wallet } from '@ethersproject/wallet';

const census3  = new VocdoniCensus3Client({ env: EnvOptions.PROD });
const vocdoni  = new VocdoniSDKClient({ env: EnvOptions.PROD, wallet: Wallet.createRandom() });

await vocdoni.createAccount(); // assumes you have a faucet pkg on PROD

const tokenCensus = await census3.createTokenCensus('0xToken', 1);

const election = Election.from({
  title: 'Token holders vote',
  endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  census: tokenCensus,        // plugs in directly
  maxCensusSize: tokenCensus.size, // recommended: pin to the snapshot size
});

election.addQuestion('Proposal X?', '', [
  { title: 'Yes', value: 0 },
  { title: 'No',  value: 1 },
]);

const electionId = await vocdoni.createElection(election);
```

`createElectionSteps` (and `createElection` internally) detects `instanceof TokenCensus` / `StrategyCensus` and embeds the token/strategy metadata into `election.meta` so downstream readers can introspect.

## Error types

Errors thrown by `VocdoniCensus3Client` are typed `Error` subclasses with static `code` numbers. Common ones:

| Class                          | Code  | When                                          |
| ------------------------------ | ----- | --------------------------------------------- |
| `ErrNotFoundToken`             | 4003  | Token isn't tracked by the service.            |
| `ErrChainIDNotSupported`       | 4013  | Chain not in `getSupportedChains()`.           |
| `ErrTokenAlreadyExists`        | 4009  | `createToken` for one already tracked.          |
| `ErrInvalidStrategyPredicate`  | 4015  | Predicate doesn't parse.                       |
| `ErrNoStrategyHolders`         | 4017  | Strategy matches zero holders.                 |
| `ErrNotFoundStrategy`          | 4005  | Strategy ID doesn't exist.                     |
| `ErrCantImportStrategy`        | 5028  | IPFS import failed or queue timeout.            |
| `ErrCensusAlreadyExists`       | 4012  | Already created.                               |
| `ErrCantCreateCensus`          | 5001  | Backend error building merkle tree.            |

Long-running operations (`createCensus`, `createStrategyCensus`, `createTokenCensus`, `getStrategyHolders`, `getStrategyEstimation`, `importStrategy`) all poll an internal queue using `tx_wait` and reject with `"Time out waiting for queue with id: <id>"` if they exhaust attempts. Bump `tx_wait.attempts` for large censuses (15+ for >100k holders).

## Pitfalls

- **Tokens must be synced before census creation.** Call `getToken(...).then(t => t.status.synced)` and wait/poll if false. `createTokenCensus` explicitly errors with `"Token is not yet synced"` otherwise.
- **Strategy predicates reference tokens by alias, not address.** The aliases are the keys in the `tokens` map; pick them deliberately and use the same in your predicate string.
- **`minBalance` is a string (decimal of raw units).** For 100 USDC (6 decimals), pass `"100000000"`. The service does *no* decimal conversion.
- **Anonymous Census3 censuses use ZK with bounded accuracy.** `accuracy` < 100 means proof generation may occasionally fail; size the strategy accordingly. For exact-set anonymous censuses, use the off-chain `WeightedCensus` path from `census.md`.
- **`maxCensusSize` on the election should be at least the Census3 `size`.** Recommended: pin them equal.
- **PROD costs PROD tokens.** Census3 is free to query, but the resulting election still costs tokens on the vochain. Estimate first via `client.estimateElectionCost(election)`.

## Cross-references

- `client.md` — also covers `VocdoniSDKClient` setup which Census3 censuses ultimately feed into.
- `census.md` — comparison with `PlainCensus`, `WeightedCensus`, `CspCensus`.
- `elections.md` — `Election.from({ census: tokenCensus })` plugs Census3 in.
- `recipes/token-census.ts` — runnable example.
- [Census3 API docs](https://github.com/vocdoni/census3/blob/main/api/README.md) — raw HTTP surface.
