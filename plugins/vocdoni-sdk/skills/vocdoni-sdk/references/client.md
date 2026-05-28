# `references/client.md` — VocdoniSDKClient setup

Companion to the [[vocdoni-sdk]] skill. Use this when setting up the main client, picking an environment, configuring polling/faucet options, or wondering which signer types are accepted.

## Install

```sh
npm i @vocdoni/sdk
# or yarn add / pnpm add
```

Peer signers come from `ethers` (v5 in the SDK as shipped). For random wallets in node/tests:

```ts
import { Wallet } from '@ethersproject/wallet';
```

## Import

```ts
// Picks the right bundle for your environment (CJS or ESM) automatically.
import { VocdoniSDKClient, EnvOptions } from '@vocdoni/sdk';

// UMD bundle if you need it (browser globals).
import SDK from '@vocdoni/sdk/umd';
```

## Constructor

```ts
new VocdoniSDKClient(opts: ClientOptions)
```

`ClientOptions`:

| Field         | Type                                          | Default                              | Notes                                                                                                                                |
| ------------- | --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `env`         | `EnvOptions`                                  | **required**                         | `EnvOptions.DEV` / `STG` / `PROD`. Determines all default URLs.                                                                      |
| `wallet`      | `Wallet \| Signer \| RemoteSigner`            | `undefined`                          | The signer used for every transaction. Can be set/replaced later via `client.wallet = …`.                                            |
| `electionId`  | `string`                                      | `undefined`                          | Pre-binds an election ID so vote/check methods don't need it on every call. Also settable via `client.setElectionId(id)`.            |
| `api_url`     | `string`                                      | env default                          | Override the API base URL. Most users never need this.                                                                               |
| `faucet`      | `Partial<FaucetOptions>`                      | env default                          | Override faucet token limit on dev/stg.                                                                                              |
| `tx_wait`     | `{ retry_time?: number; attempts?: number }`  | `{ retry_time: 5000, attempts: 6 }`  | Transaction-confirmation polling. Total wall-clock cap ≈ `retry_time * attempts`.                                                    |
| `census`      | `{ async?: boolean; wait_time?: number; chunk?: number }` | `{ async: true, wait_time: 5000, chunk: 8192 }` | Tuning for census creation/publish — chunk size, async polling cadence.                                                              |

### `EnvOptions`

```ts
enum EnvOptions {
  DEV  = 'dev',   // api: api-dev.vocdoni.net  | resets often, faucet auto-funds, fastest iteration
  STG  = 'stg',   // api: api-stg.vocdoni.net  | stable testnet, RECOMMENDED for development
  PROD = 'prod',  // api: api.vocdoni.io       | mainnet; faucet disabled; needs real tokens
}
```

Default URLs per env:

| Env    | API                              | Faucet                                  | Explorer                  |
| ------ | -------------------------------- | --------------------------------------- | ------------------------- |
| DEV    | `https://api-dev.vocdoni.net/v2` | `https://api-dev.faucet.vocdoni.net/v2` | `https://dev.explorer.vote` |
| STG    | `https://api-stg.vocdoni.net/v2` | `https://api-stg.faucet.vocdoni.net/v2` | `https://stg.explorer.vote` |
| PROD   | `https://api.vocdoni.io/v2`      | `https://api-faucet.vocdoni.io/v2`      | `https://explorer.vote`     |

`client.explorerUrl` returns the explorer URL for the active env — useful for links in logs (`{explorerUrl}/processes/show/#/{electionId}` and `{explorerUrl}/verify/#/{voteId}`).

## Signer choices

| Signer                                    | When to use                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Wallet.createRandom()` (ethers)          | Tests, ephemeral voters, anything where the key only needs to live for the script.                           |
| `new Wallet(privateKey)`                  | Server-side persisted accounts (faucet packages, organisation accounts).                                     |
| Browser provider via `Web3Provider`       | Frontend apps: MetaMask, WalletConnect, etc. Pass `provider.getSigner()`.                                    |
| `VocdoniSDKClient.generateWalletFromData([user, hashedPassword])` | Deterministic wallet derived from arbitrary data (e.g., login + password hash). Useful when voters don't own a wallet — covered in `accounts.md`. |
| `client.generateRandomWallet()`           | Mutates `client.wallet` to a fresh random wallet and returns the private key.                                |
| `RemoteSigner`                            | When signing happens behind an HTTP API (Vocdoni's SaaS or your own). See "Remote signer" below.             |

You can also swap the active signer at any time:

```ts
client.wallet = anotherWallet; // next transactions use the new wallet
```

## Service properties on the client

Every area has a dedicated service exposed as a public property. You usually use the convenience methods on the client itself, but the services are there if you need lower-level control:

```ts
client.accountService    // AccountService
client.electionService   // ElectionService
client.voteService       // VoteService
client.censusService     // CensusService
client.anonymousService  // AnonymousService (ZK voting)
client.cspService        // CspService (blind-signature voting)
client.chainService      // ChainService (chain data, txInfo, dateToBlock, etc.)
client.faucetService     // FaucetService (dev/stg only)
client.fileService       // FileService (calculateCID for IPFS)
```

## Reading state from the client

```ts
client.url           // current API endpoint
client.explorerUrl   // explorer base URL for the active env
client.wallet        // active signer (or null)
client.electionId    // currently-bound election ID (or null)
```

## Polling and waits

- **Transaction confirmation** uses `tx_wait` (default 5 s × 6 = 30 s max). If a tx isn't mined in that window, the call rejects with `"Time out waiting for transaction: …"`. Increase `attempts` on slow networks.
- **Election readiness** is *not* the same as transaction confirmation. After `createElection()` resolves, the election still needs a few blocks before `status === ONGOING`. Poll `fetchElection(id)` every ~5 s; recipes show this pattern.
- **Census publish** is async by default — the SDK polls the service. Tune via the `census` option if you publish very large censuses.

## Remote signer

For Vocdoni's SaaS (or any HTTP-based signer):

```ts
import { RemoteSigner } from '@vocdoni/sdk';

const signer = new RemoteSigner({
  url: 'https://saas.vocdoni.io',
  credentials: { email: 'me@example.com', password: '…' },
});
await signer.login(); // returns auth token; also refreshes internally

const client = new VocdoniSDKClient({ env: EnvOptions.PROD, wallet: signer });
```

`RemoteSigner` implements the `ethers.Signer` interface (`getAddress`, `signMessage`, …) and is accepted anywhere a `Wallet` is.

## Hello-world client setup

```ts
import { Wallet } from '@ethersproject/wallet';
import { EnvOptions, VocdoniSDKClient } from '@vocdoni/sdk';

const wallet = Wallet.createRandom();
const client = new VocdoniSDKClient({
  env: EnvOptions.STG, // start here unless you have a reason to use DEV or PROD
  wallet,
});

console.log(client.url);         // https://api-stg.vocdoni.net/v2
console.log(client.explorerUrl); // https://stg.explorer.vote
```

That's the only client setup most apps ever need. From here, go to:

- `accounts.md` to fund and register the wallet on the vochain.
- `census.md` to build a voter list.
- `elections.md` to create your first election.
