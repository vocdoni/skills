# `references/errors.md` — Common errors and gotchas

Companion to the [[vocdoni-sdk]] skill. Use this when debugging a thrown error or a flow that hangs / produces a wrong result. The errors are grouped by where they originate.

## Client / setup errors

| Symptom                                          | Likely cause                                                                       | Fix                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `No wallet set`                                  | You called a method that signs, but `client.wallet` is null.                       | Set `client.wallet = …` or pass `{ wallet }` in the options object.                  |
| `No election set`                                | Voting/inspection method without `electionId`.                                     | Call `client.setElectionId(id)` or pass `{ electionId }`.                            |
| `No URL set`                                     | API base URL is missing — `env` and `api_url` both unset (rare).                   | Pass `env: EnvOptions.STG` (or whichever) to the constructor.                        |
| `Account is archived`                            | `fetchAccount(address)` on an archived account.                                    | Use `fetchAccountInfo` instead (returns archived accounts too).                       |
| `Invalid faucet package`                         | Passed a malformed string to `createAccount({ faucetPackage })`.                   | Re-fetch the base64; verify with `parseFaucetPackage`.                                |

## Account errors

| Symptom                                                                     | Likely cause                                                            | Fix                                                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `createAccount` succeeds, `balance === 0`                                   | On PROD; faucet is disabled.                                            | Pass `faucetPackage` obtained from Vocdoni.                                        |
| `collectFaucetTokens` rejects                                               | Already funded, or on PROD.                                             | Skip if `balance > 0`; don't call on PROD.                                         |
| `Time out waiting for transaction: …` during `createAccount`                | Chain congested or wallet has no faucet on this env.                    | Retry; bump `tx_wait.attempts`; verify env-correct faucet.                          |

## Election creation errors

| Symptom                                                  | Likely cause                                                                                                              | Fix                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `endDate must be after startDate`                        | Pass-through of an invariant.                                                                                             | Set `endDate > startDate`; or omit `startDate`.                                              |
| `Election title cannot be empty`                         | `title.default` is empty.                                                                                                 | Always set `title` (string or `{ default: '…' }`).                                            |
| `Census not valid`                                       | Passed something that isn't a `Census` subclass.                                                                          | Pass a `PlainCensus` / `WeightedCensus` / etc.                                                |
| `maxCensusSize must be greater than 0`                   | `maxCensusSize: 0` literally.                                                                                              | Set to `census.size`, omit, or ≥ 1.                                                           |
| `This type of election can only have one question`       | Called `addQuestion` more than once on an Approval/MultiChoice/Budget/Quadratic election.                                  | Add a single question; use base `Election` for multi-question polls.                          |
| `meta key "sdk" is reserved`                             | You tried to put `meta: { sdk: … }`.                                                                                       | Use a different key; `sdk` is auto-populated unless `addSDKVersion: false`.                   |
| Insufficient balance for election                        | `client.estimateElectionCost(election) > account.balance`.                                                                | Top up via faucet or PROD faucet package; reduce `maxCensusSize`/duration.                    |
| `Time out waiting for transaction: …` during create      | Chain accepting the tx slow; or wallet not funded; or someone else won the nonce race.                                    | Retry; bump `tx_wait.attempts`; for many-elections-in-a-row, serialise.                       |

## Voting errors

| Symptom                                              | Likely cause                                                                                                                                      | Fix                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Vote rejected with "not in census"                   | `client.wallet.address` is not in the census; or anonymous-vs-weighted mismatch.                                                                  | `await client.isInCensus()` first. Anonymous election needs anonymous census.                                  |
| Vote rejected with "election not ready"              | Election is not yet `ONGOING`; you submitted too fast after `createElection`.                                                                     | Poll `fetchElection(id).status` until `ONGOING` (block time ~10–13 s; budget ~30 s after create).               |
| `Invalid vote` from `checkVote`                      | Vote shape doesn't match election type (length, value range, uniqueness, cost cap).                                                               | Read `election-types.md` for the variant's shape; call `publishedElection.checkVote(vote)` first.              |
| `Vote already submitted`                             | `maxVoteOverwrites` exhausted.                                                                                                                    | Check `votesLeftCount` first; raise `maxVoteOverwrites` if you want changeable votes.                          |
| `hasAlreadyVoted` always returns `null` on anonymous | Anonymous vote IDs are not deterministic — SDK can't recompute without the signature.                                                              | Save `voteId` returned by `submitVote`; pass it as `{ voteId }`.                                                |
| Anonymous vote fails with no SIK                     | Voter never registered a SIK on this chain, or used a different password.                                                                          | `createAccount({ sik: true, password })` once per voter; use the same password at vote time.                     |

## Census creation / publishing errors

| Symptom                                          | Likely cause                                                                       | Fix                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Census creation hangs                            | Default polling exhausted on a large census.                                       | Increase `client.censusService.async.wait` or call `createCensus` synchronously.      |
| `isAddress(...) === false` on `add`              | Address malformed.                                                                 | Use `getAddress(...)` from ethers to normalise.                                       |
| `weight` validation fails                        | Passed a `number` instead of `bigint`.                                             | Use `BigInt(123)` or `123n`.                                                          |
| `fetchProof` throws "not found"                  | Address not in census; or census not yet published.                                | Add address before publishing; await publish completion.                              |

## Census3 errors

| Symptom                                                  | Likely cause                                                                                          | Fix                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Token is not yet synced`                                | `createTokenCensus` before `getToken(...).status.synced` is true.                                     | Poll `getToken` and wait.                                                          |
| `ErrInvalidStrategyPredicate`                            | Predicate string doesn't parse.                                                                       | Use `validatePredicate(p)` to debug; check operator spelling (`AND`, not `&&`).    |
| `ErrNoStrategyHolders`                                   | The predicate matches zero addresses.                                                                 | Relax `minBalance`, broaden tokens.                                                |
| `Time out waiting for queue with id: …`                  | Large census creation exceeded `tx_wait.attempts`.                                                    | Bump `tx_wait.attempts` to 20+ in client constructor.                              |
| `ErrChainIDNotSupported`                                 | Used a chain not in `getSupportedChains()`.                                                           | Check support; some chains exist on PROD but not DEV/STG and vice versa.            |

## Status / fetching errors

| Symptom                                  | Likely cause                                                                                  | Fix                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `results` is empty after vote            | `secretUntilTheEnd = true` — votes encrypted until election ends.                              | Wait until `status === ENDED` / `RESULTS`.                                       |
| Metadata appears as `<redacted>`         | `electionType.metadata.encrypted = true` and you didn't pass the password.                    | `fetchElection(id, '<password>')`.                                               |
| `status === PROCESS_UNKNOWN`             | Wrong electionId or wrong env.                                                                | Verify the ID; confirm same env you created on.                                  |

## CSP errors

| Symptom                                  | Likely cause                                                                                  | Fix                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `cspStep` 4xx / 5xx                      | CSP refuses; the auth payload was wrong.                                                      | Read the CSP's docs; check `cspInfo()` for required schema.                       |
| Vote rejected with "invalid signature"   | `CspCensus.publicKey` doesn't match what the CSP signed with.                                  | Re-confirm the public key; rebuild the election.                                  |
| `cspSign` throws on later election       | Token expired or already used.                                                                | Re-run the full auth flow.                                                        |

## General debugging checklist

1. **Confirm env.** `client.url` and `client.explorerUrl` should match what you expect.
2. **Confirm signer.** `await client.wallet.getAddress()` returns the address you think.
3. **Confirm electionId is set.** `client.electionId`.
4. **Confirm election is ready before voting.** `(await client.fetchElection(id)).status === ElectionStatus.ONGOING`.
5. **Confirm voter is in census.** `await client.isInCensus()`.
6. **Confirm vote shape locally.** `(await client.fetchElection(id)).checkVote(vote)` — throws with a clear message before paying for the tx.
7. **Match account balance vs election cost.** `await client.estimateElectionCost(election)` ≤ `(await client.fetchAccountInfo()).balance`.

## Cross-references

- `client.md` — env and `tx_wait` tuning.
- `accounts.md` — faucet, balance.
- `elections.md`, `election-types.md` — election shape.
- `voting.md` — the check methods listed above.
- `anonymous.md` — SIK and password specifics.
- `csp.md` — CSP-specific failure modes.
- `census3.md` — Census3 queue timeouts.
