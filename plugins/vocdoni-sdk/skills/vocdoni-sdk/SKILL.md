---
name: vocdoni-sdk
description: Use this skill whenever the user is building, debugging, or asking questions about code that uses the Vocdoni SDK (`@vocdoni/sdk`) — the TypeScript/JavaScript library for the Vocdoni voting protocol. Triggers on imports from `@vocdoni/sdk`, mentions of VocdoniSDKClient, VocdoniCensus3Client, creating elections, voting on Vocdoni, Vochain, census creation (PlainCensus/WeightedCensus/CspCensus/TokenCensus/StrategyCensus), election variants (approval / ranked / multichoice / budget / quadratic), anonymous (ZK) voting, CSP-based voting, token-gated censuses via Census3, faucet/account bootstrap, EnvOptions.DEV/STG/PROD, or any prompt like "how do I create a poll", "vote on this election", "get election results", "token holder census" in a context where Vocdoni is in play. Even when the user names only a high-level intent ("I want quadratic voting", "anonymous voting"), load this skill — the SDK has specific class/method shapes the agent must use and is unlikely to recall accurately without consulting it.
---

# Vocdoni SDK

The `@vocdoni/sdk` TypeScript/JavaScript library is the official client for the [Vocdoni voting protocol](https://docs.vocdoni.io). It lets an application:

- Bootstrap a signing account on the Vocdoni chain (vochain).
- Build a census of eligible voters (plain list, weighted, CSP-gated, or token-holder via Census3).
- Create a voting process ("election") with a wide range of variants and configurations.
- Cast votes and read results.

This skill is the entry point. Read the section that matches the task; load the reference file from `references/` for the full API; lift a recipe from `recipes/` when you need a complete working flow.

## How to use this skill

1. **Identify which area of the SDK the task touches.** The "Common task → reference" table below maps user intents to files.
2. **Read only the references you need.** Each reference is a self-contained map of one area's classes, types, and methods, with terse rationale and short examples. Most tasks need 1–3 references.
3. **Start from a recipe when the task fits one.** The `recipes/` directory has complete, runnable TypeScript files for the canonical flows. Copy the relevant one, then adapt — don't reinvent the boilerplate.
4. **Stay within the documented API.** The SDK has many subtle shape requirements (which census type goes with which election type, which fields are required for which variant, default values). The reference files spell these out. Guessing leads to runtime errors.

## Common task → reference

| User wants to…                                          | Read first                                                   | Recipe                            |
| ------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| Set up the client / pick environment                    | `references/client.md`                                       | —                                 |
| Create or fund an account                               | `references/accounts.md`                                     | —                                 |
| Build a list-of-addresses census                        | `references/census.md`                                       | `recipes/basic-poll.ts`           |
| Build a per-voter weighted census                       | `references/census.md`                                       | `recipes/weighted-census.ts`      |
| Create a vanilla yes/no or multi-question poll          | `references/elections.md` + `references/voting.md`           | `recipes/basic-poll.ts`           |
| Approval voting (pick N of M)                           | `references/election-types.md` + `references/voting.md`      | `recipes/approval-vote.ts`        |
| Quadratic voting                                        | `references/election-types.md` + `references/voting.md`      | `recipes/quadratic-vote.ts`       |
| Ranked / linear-weighted-choice voting                  | `references/election-types.md` + `references/voting.md`      | `recipes/ranked-vote.ts`          |
| Multi-choice voting (min/max, can-abstain)              | `references/election-types.md` + `references/voting.md`      | `recipes/multichoice-vote.ts`     |
| Budget-based voting (allocate credits)                  | `references/election-types.md` + `references/voting.md`      | —                                 |
| Anonymous voting (ZK proofs hide voter identity)        | `references/anonymous.md` + `references/voting.md`           | `recipes/anonymous-vote.ts`       |
| CSP-gated voting (blind-signature census)               | `references/csp.md` + `references/census.md`                 | `recipes/csp-vote.ts`             |
| Token-holder census from an ERC20/721                   | `references/census3.md`                                      | `recipes/token-census.ts`         |
| Multi-token strategy census ("(A OR B) AND C")          | `references/census3.md`                                      | `recipes/token-census.ts`         |
| Read election results / status                          | `references/results.md`                                      | —                                 |
| Pause / cancel / end / continue an election             | `references/elections.md`                                    | —                                 |
| Debug a runtime error                                   | `references/errors.md`                                       | —                                 |
| Understand the on-chain ballot/results encoding         | sibling skill [[vocdoni-ballot-protocol]]                    | —                                 |

## The SDK in one minute

```ts
import { Wallet } from '@ethersproject/wallet';
import {
  Election,
  EnvOptions,
  PlainCensus,
  VocdoniSDKClient,
  Vote,
} from '@vocdoni/sdk';

// 1. Client. EnvOptions.STG is the recommended testing environment; DEV resets often; PROD is mainnet.
const creator = Wallet.createRandom();
const client = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: creator });

// 2. Bootstrap the creator's account on the Vocdoni chain (faucet runs automatically on STG/DEV).
await client.createAccount();

// 3. Build a census of eligible voters.
const census = new PlainCensus();
const voter = Wallet.createRandom();
census.add(await voter.getAddress());

// 4. Define and create the election. The end date is required.
const election = Election.from({
  title: 'Is the sky blue?',
  description: 'A very important question',
  endDate: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  census,
});
election.addQuestion('Pick one', '', [
  { title: 'Yes', value: 0 },
  { title: 'No',  value: 1 },
]);
const electionId = await client.createElection(election);
client.setElectionId(electionId);

// 5. Vote (as the voter, not the creator). Wait ~28s for the election to be ready on-chain.
await new Promise((r) => setTimeout(r, 28_000));
client.wallet = voter;
await client.submitVote(new Vote([0])); // votes "Yes"

// 6. Read results.
const result = await client.fetchElection();
console.log(result.results); // [[ "1", "0" ]]  → 1 vote for choice 0 ("Yes")
```

This is the spine of every Vocdoni flow. Every variant — anonymous, CSP, token-gated, quadratic, ranked — is the same shape with a different census, a different election variant class, and/or different `voteType` parameters.

## Mental model

- **Vocdoni runs its own blockchain (the *vochain*).** Account creation, election creation, and votes are all signed transactions against this chain.
- **Three blockchain environments:** `EnvOptions.DEV` (resets often, faucet on), `EnvOptions.STG` (stable testnet, recommended), `EnvOptions.PROD` (real elections). The same code works on all three; only the constant changes.
- **Two clients:** `VocdoniSDKClient` (everything on the vochain) and `VocdoniCensus3Client` (a separate API that produces censuses from on-chain ERC20/721 holdings). They cooperate: Census3 hands a `TokenCensus`/`StrategyCensus` to the main client.
- **The signer matters who you're acting as.** Creating an election uses the creator's wallet; submitting a vote uses the voter's wallet. The client's `wallet` is mutable (`client.wallet = voter`) and a new client can be cheaply instantiated per actor.
- **`client.setElectionId(id)` is sticky.** Many methods (`submitVote`, `isInCensus`, `hasAlreadyVoted`, `fetchElection`) default to this stored ID. Forgetting to set it is a frequent bug.
- **Election creation is asynchronous on-chain.** After `createElection()` returns, wait until `client.fetchElection(id).then(e => e.status)` reaches `ElectionStatus.ONGOING` before voting. Block time is ~10–13s; recipes show the polling pattern.
- **Census types are bound to election types.** Anonymous elections need an anonymous-type census; CSP elections need a `CspCensus`; weighted/quadratic typically want a `WeightedCensus`. `references/census.md` and `references/election-types.md` cross-link these constraints.

## A note on Census3 vs the main SDK

If the user wants a census **from token holders or LP positions on a real chain (Ethereum, Polygon, …)**, that comes from [Census3](https://github.com/vocdoni/census3), exposed via `VocdoniCensus3Client` in the same npm package. It returns a `TokenCensus` or `StrategyCensus` that plugs directly into `Election.from({ census, … })` on the main `VocdoniSDKClient`. Treat Census3 as a sibling service — separate API, different methods, same package import.

## Trustworthy reading order when the task is open-ended

If the user hasn't pinned the shape of the task, this is the safest order to load context:

1. `references/client.md` — confirms env, signer, and which constants you'll need.
2. `references/elections.md` — the core `Election.from()` shape, `IElectionType`, `IVoteType`, lifecycle.
3. `references/census.md` — pick the right census class for the election.
4. `references/voting.md` — submit-vote shape, the `Vote` constructor, the check methods (`isInCensus`, `hasAlreadyVoted`).
5. Then a `recipes/*.ts` file for the closest scenario.

Anonymous, CSP, Census3, and election-type variants are specializations of this baseline — go to their reference when you know that's the shape.

## Sibling skill: the ballot protocol

For protocol-level questions ("what shape is the vote array", "what does my result matrix mean", "what is `costExponent` *really*", "discrete vs index-weighted aggregation"), load the [[vocdoni-ballot-protocol]] skill in the same plugin. It encodes the on-chain data model the SDK serialises into — useful for debugging vote-shape errors and understanding why a given election variant constrains things the way it does.

