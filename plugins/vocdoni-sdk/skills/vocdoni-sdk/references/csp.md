# `references/csp.md` — CSP voting (blind signatures)

Companion to the [[vocdoni-sdk]] skill. Use this when an *external authority* — a CSP (Credential Service Provider) — controls who can vote, rather than an on-chain census. Read `census.md` and `voting.md` first.

## What is a CSP?

A CSP is an HTTP service that authorises voters. The flow:

1. The election uses a `CspCensus(publicKey, url)` instead of a participant list. The chain doesn't know voters; the CSP does.
2. A voter authenticates against the CSP through whatever protocol the CSP defines (a couple of round-trips, see "Auth steps").
3. The CSP issues a **blind signature** the voter can use to prove they were authorised — without the chain learning the voter's identity from the CSP's perspective.
4. The voter submits a `CspVote` with the unblinded signature; the chain verifies it against the CSP's public key.

Use cases: KYC-gated elections, allowlist memberships managed in a CRM, anti-Sybil with PoH, anything where eligibility is dynamic and managed off-chain.

The SDK ships against [`vocdoni/blind-csp`](https://github.com/vocdoni/blind-csp); the wire shape is theirs.

## Creating a CSP-gated election

```ts
import { CspCensus, Election } from '@vocdoni/sdk';

const census = new CspCensus(
  CSP_PUBKEY, // hex string, with or without 0x prefix
  CSP_URL,    // base URL of the CSP service
);

const election = Election.from({
  title: 'Members only',
  endDate: new Date(Date.now() + 24 * 3600 * 1000),
  census,
});

election.addQuestion('Yes or no?', '', [
  { title: 'Yes', value: 0 },
  { title: 'No',  value: 1 },
]);

const electionId = await client.createElection(election);
```

There's no `.add()` on a `CspCensus` — the participant set is the CSP's business.

## The voting flow

```ts
import { CspVote, EnvOptions, VocdoniSDKClient, Vote } from '@vocdoni/sdk';

const client = new VocdoniSDKClient({
  env: EnvOptions.STG,
  wallet: voterWallet,
  electionId,
});

// 1. Step through the CSP's auth protocol. Number of steps and payloads are CSP-defined.
const step0 = (await client.cspStep(0, ['User name'])) as ICspIntermediateStepResponse;
const step1 = (await client.cspStep(
  1,
  [step0.response.reduce((acc, v) => +acc + +v, 0).toString()], // example: arithmetic challenge
  step0.authToken,
)) as ICspFinalStepResponse;

// 2. Obtain a blind signature for this voter's address.
const signature = await client.cspSign(voterWallet.address, step1.token);

// 3. Build a CspVote with the unblinded signature.
const vote = client.cspVote(new Vote([0]), signature);

// 4. Submit it.
const voteId = await client.submitVote(vote);
```

### `cspStep(stepNumber, data, authToken?)`

CSPs implement a multi-step authentication. The first call (`stepNumber = 0`) returns an `authToken` to pass into the next; the final call returns a `token` for `cspSign`. Each CSP defines what `data` it expects.

Returns vary by step:

```ts
type ICspIntermediateStepResponse = {
  authToken: string;
  response: string[];   // CSP-specific (e.g. a challenge to respond to)
};

type ICspFinalStepResponse = {
  token: string;        // hand to cspSign()
};
```

If the CSP only needs one round, you may have a single `cspStep(0, …)` returning a final response directly. Refer to the CSP's docs.

### `cspSign(address, token)`

```ts
client.cspSign(address: string, token: string): Promise<string>
```

Returns an unblinded blind signature. Internally this is `getBlindedPayload(electionId, hexTokenR, address)` → CSP signs the blinded blob → `CensusBlind.unblind(...)` to recover the usable signature.

### `cspVote(vote, signature, proof_type?)`

Convenience constructor for `CspVote`:

```ts
const cspVote = client.cspVote(new Vote([0]), signature);
// equivalent to: new CspVote([0], signature, CspProofType.ECDSA_BLIND);
```

`proof_type` defaults to whatever the SDK negotiates; override only if your CSP requires a non-default type:

```ts
import { CspProofType } from '@vocdoni/sdk';

// Available types
CspProofType.ECDSA
CspProofType.ECDSA_PIDSALTED
CspProofType.ECDSA_BLIND          // most common
CspProofType.ECDSA_BLIND_PIDSALTED
```

### `cspUrl()` and `cspInfo()`

If you need to inspect the configured CSP from the election:

```ts
const url  = await client.cspUrl();   // CSP base URL for the election
const info = await client.cspInfo();  // CSP-specific metadata (auth steps, schemas)
```

## `CspVote` reference

```ts
class CspVote extends Vote {
  constructor(
    votes: Array<number | bigint>,
    signature: string,          // required
    proof_type?: CspProofType,
    weight?: bigint,            // optional; CSP-supplied weight if any
  );
  signature: string;
  proof_type?: CspProofType;
  weight?: bigint;
}
```

## What the SDK does for you vs you do

| Step                                    | Who does it                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Build the blinded payload               | SDK — `cspSign` calls `getBlindedPayload(electionId, …)`                                          |
| Send the blinded payload to the CSP     | SDK — internal HTTP call to the CSP's sign endpoint                                                |
| Unblind the returned signature          | SDK — `CensusBlind.unblind(…)`                                                                    |
| Run the auth protocol with the CSP      | Mixed — SDK provides `cspStep`, but the payload values are application-specific                  |
| Verify the CSP signature on-chain       | Vochain — when you `submitVote(cspVote)`                                                          |

## Pitfalls

- **Number of steps and data shape are CSP-dependent.** The README example uses an arithmetic challenge (`reduce((+a)+(+v))`); your CSP may use OAuth, OTP, KYC verification, etc. Always check the CSP's own docs for step shape.
- **`CspCensus.publicKey` must match the CSP's actual signing key.** Mismatch → all votes rejected by the chain.
- **One CSP signature per election per voter** (typically). Re-submitting requires going through the auth flow again unless the CSP issues reusable tokens.
- **CSP downtime kills voting.** Plan for it; cache nothing privileged client-side.

## Cross-references

- `census.md` — `CspCensus` construction.
- `voting.md` — `submitVote` accepts `CspVote` transparently.
- `recipes/csp-vote.ts` — runnable example.
- [`vocdoni/blind-csp`](https://github.com/vocdoni/blind-csp) — the reference CSP implementation.
