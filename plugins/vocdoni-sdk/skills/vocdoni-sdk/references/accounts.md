# `references/accounts.md` — Accounts, faucet, balance

Companion to the [[vocdoni-sdk]] skill. Use this when registering an account on the vochain, fetching account info, funding via the faucet, transferring tokens, or generating deterministic wallets for users that don't own one.

## The mental model

Every signer that wants to **create elections** must first register an account on the vochain. Voters don't need an account — they just need to be in the census. The fee for registration and for creating elections is paid in Vocdoni tokens; on DEV/STG these come from the faucet automatically, on PROD you get them out-of-band.

## Bootstrap a new account

```ts
await client.createAccount();
```

`createAccount` is idempotent: it fetches the account if it already exists, otherwise it registers it (and on DEV/STG, calls the faucet automatically). Safe to call on every app start.

Full signature and options:

```ts
client.createAccount(options?: {
  account?: Account;       // metadata; see below
  faucetPackage?: string;  // base64 string from a faucet; required on PROD
  sik?: boolean;           // generate Secret Identity Key (for anonymous voting). Default: true
  password?: string;       // password used in SIK derivation. Default: '0'
}): Promise<AccountData>
```

Return value:

```ts
type AccountData = {
  account: Account;          // metadata
  address: string;           // 0x-stripped lowercase address
  balance: number;           // in Vocdoni tokens
  nonce: number;             // next-tx nonce
  electionIndex: number;     // how many elections this account has created
  infoURL: string | null;    // IPFS URI of the metadata blob
  sik: string;               // Secret Identity Key
  transfersCount: number;
  feesCount: number;
};
```

## Account metadata

```ts
import { Account } from '@vocdoni/sdk';

await client.createAccount({
  account: new Account({
    languages: ['en'],
    name: { default: 'Acme Corp', es: 'Acme S.A.' },
    description: 'Our org account on Vocdoni',
    feed: 'https://acme.example/feed.json',
    avatar: 'https://acme.example/avatar.png',
    header: 'https://acme.example/header.png',
    logo:   'https://acme.example/logo.png',
    meta: [
      { key: 'twitter', value: 'https://twitter.com/acme' },
      { key: 'website', value: 'https://acme.example' },
      // value can be any JSON: string, number, array, object
    ],
  }),
});
```

`Account` accepts:

| Field         | Type                                       | Notes                                                                  |
| ------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `languages`   | `string[]`                                 | ISO codes for translations supplied in name/description/feed.          |
| `name`        | `string \| MultiLanguage<string>`          | A plain string auto-converts to `{ default: value }`.                  |
| `description` | `string \| MultiLanguage<string>`          | Same string ↔ multi-language behavior.                                 |
| `feed`        | `string \| MultiLanguage<string>`          | URL or per-language URL to a feed (news/activity).                     |
| `header`      | `string`                                   | URL of header image.                                                   |
| `avatar`      | `string`                                   | URL of avatar.                                                         |
| `logo`        | `string`                                   | URL of logo.                                                           |
| `meta`        | `Array<{ key: string; value: any }>`       | Arbitrary key/value pairs. Each `value` may be any JSON.               |

`MultiLanguage<string>` is `{ default: string; [lang: string]: string }`. The `default` entry is mandatory if any per-language entries are provided.

## Update metadata later

```ts
await client.updateAccountInfo(
  new Account({ name: 'New name', logo: 'https://…' })
);
```

`updateAccountInfo` overwrites the metadata. The wallet must already have an account.

## Fetch account info without auto-creating

If you only want to read state and not implicitly create the account, use `fetchAccountInfo` (returns archived accounts as well):

```ts
const info = await client.fetchAccountInfo();                       // own account
const info = await client.fetchAccountInfo('0x123…abc');            // any address
```

Use `fetchAccount(address?)` when you want to **assert** the account exists and is active — it throws on archived accounts.

## Faucet — funding accounts on DEV/STG

On DEV and STG, `createAccount()` auto-collects tokens. After creation you can also top up:

```ts
const info = await client.createAccount();
if (info.balance === 0) {
  await client.collectFaucetTokens(); // dev/stg only; throws on prod
}
```

If you want the raw payload (e.g. to inspect it):

```ts
const b64 = await client.fetchFaucetPayload();     // dev/stg only
const parsed = client.parseFaucetPackage(b64);     // decode the base64
```

On PROD, the faucet endpoint is disabled. Pass a faucet package obtained out-of-band:

```ts
await client.createAccount({ faucetPackage: '<base64 string from Vocdoni>' });
```

If you bootstrap and the same wallet calls `collectFaucetTokens()` twice (already funded), the call rejects.

## Transfer tokens between accounts

```ts
await client.sendTokens({
  to: '0xRecipientAddress',
  amount: 100,
});
```

The `wallet` option may override which signer pays; otherwise `client.wallet` is used.

## Wallet helpers

### Generate a random wallet bound to the client

```ts
const privateKey = client.generateRandomWallet();
// client.wallet is now a fresh Wallet; save the privateKey if you need persistence
```

### Generate a deterministic wallet from arbitrary data

Useful when voters authenticate via your own login system (no on-chain identity). Same `data` always derives to the same address:

```ts
import { VocdoniSDKClient } from '@vocdoni/sdk';

// sha256('test') = 9f86d081…
const userWallet = VocdoniSDKClient.generateWalletFromData([
  'user1',
  '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
]);

console.log(userWallet.address); // 0x8AF1b3EDB817b5854e3311d583905a3421F49829
```

The `data` argument is concatenated (`Array.prototype.join('')`) before keccak256. **Different orderings give different wallets** — pick an order and stick to it across your codebase.

This wallet can be used for both census membership and voting. Combine it with a per-user login + hashed password for "no-wallet" UX.

## Account lifecycle

- `createAccount` — register + optional faucet (idempotent).
- `updateAccountInfo(account)` — change metadata.
- `fetchAccountInfo([address])` / `fetchAccount([address])` — read state.
- `collectFaucetTokens([package])` — top up on DEV/STG.
- `sendTokens({ to, amount, wallet? })` — transfer.

That's the full account API. The next thing you need is a census of voters — see `census.md`.
