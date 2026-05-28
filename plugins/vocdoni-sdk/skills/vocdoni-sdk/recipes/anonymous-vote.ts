/**
 * recipes/anonymous-vote.ts
 *
 * Anonymous voting using zero-knowledge proofs. Each voter registers a Secret
 * Identity Key (SIK) and submits an AnonymousVote; the chain verifies the
 * voter is in the census and hasn't voted before, without learning who they are.
 *
 * Key differences from basic-poll.ts:
 *   - electionType.anonymous = true
 *   - Each voter calls createAccount({ sik: true, password })
 *   - submitVote receives an AnonymousVote (with the same password)
 *   - hasAlreadyVoted / votesLeftCount need an explicit voteId on this election
 */

import { Wallet } from '@ethersproject/wallet';
import {
  AnonymousVote,
  Election,
  ElectionStatus,
  EnvOptions,
  VocdoniSDKClient,
  WeightedCensus,
} from '@vocdoni/sdk';

const VOTERS_NUM = 5;
// Use a non-default password to make the SIK derivation explicit
const SIK_PASSWORD = 'demo-password';

async function waitForElectionReady(c: VocdoniSDKClient, id: string) {
  while ((await c.fetchElection(id)).status !== ElectionStatus.ONGOING) {
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

async function main() {
  // 1. Creator
  const creator = Wallet.createRandom();
  const client = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: creator });
  await client.createAccount();

  // 2. Voters + anonymous census. Same WeightedCensus code as a regular one —
  //    the election's `anonymous: true` flag causes it to be published as
  //    CensusType.ANONYMOUS at createElection() time.
  const voters = Array.from({ length: VOTERS_NUM }, () => Wallet.createRandom());
  const census = new WeightedCensus();
  census.add(voters.map((v) => ({ key: v.address, weight: BigInt(1) })));

  // 3. Election with anonymous = true
  const election = Election.from({
    title: 'Secret ballot',
    description: 'Anonymous yes/no',
    endDate: new Date(Date.now() + 60 * 60 * 1000),
    census,
    maxCensusSize: voters.length,
    electionType: { anonymous: true },
  });
  election.addQuestion('Approve?', '', [
    { title: 'Yes', value: 0 },
    { title: 'No', value: 1 },
  ]);

  const electionId = await client.createElection(election);
  client.setElectionId(electionId);
  console.log(`Election created: ${client.explorerUrl}/processes/show/#/${electionId}`);

  await waitForElectionReady(client, electionId);

  // 4. Each voter: register SIK then vote
  const voteIds: string[] = [];
  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i];
    const voterClient = new VocdoniSDKClient({
      env: EnvOptions.STG,
      wallet: voter,
      electionId,
    });

    // Register the SIK on the chain. Same password must be used at vote time.
    await voterClient.createAccount({ sik: true, password: SIK_PASSWORD });

    // Submit the anonymous vote. Pass undefined for signature so the SDK
    // derives it from voterClient.wallet via signSIKPayload.
    const vote = new AnonymousVote([i % 2], undefined, SIK_PASSWORD);
    const voteId = await voterClient.submitVote(vote);
    voteIds.push(voteId);
    console.log(`voter ${i} voted: ${voteId}`);
  }

  // 5. Read results. NOTE: hasAlreadyVoted on an anonymous election needs the
  //    voteId because the nullifier isn't recoverable from address alone.
  const result = await client.fetchElection();
  console.log('Tallies:', result.results);

  // Example: check voter 0 already voted
  const stillCount = await client.votesLeftCount({
    wallet: voters[0],
    voteId: voteIds[0],
  });
  console.log(`voter 0 has ${stillCount} votes left`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
