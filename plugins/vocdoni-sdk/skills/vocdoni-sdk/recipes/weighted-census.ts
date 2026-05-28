/**
 * recipes/weighted-census.ts
 *
 * Election with a WeightedCensus — each voter has a custom voting weight.
 * Used for token-stake votes, share-based DAOs, or anything where one address
 * counts for more than one.
 */

import { Wallet } from '@ethersproject/wallet';
import {
  Election,
  ElectionStatus,
  EnvOptions,
  ICensusParticipant,
  VocdoniSDKClient,
  Vote,
  WeightedCensus,
} from '@vocdoni/sdk';

async function waitForElectionReady(c: VocdoniSDKClient, id: string) {
  while ((await c.fetchElection(id)).status !== ElectionStatus.ONGOING) {
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

async function main() {
  const creator = Wallet.createRandom();
  const client = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: creator });
  await client.createAccount();

  // Voters with explicit weights (1, 2, 4, 8, 16 — geometric for visibility)
  const voters: Wallet[] = [];
  const participants: ICensusParticipant[] = [];
  for (let i = 0; i < 5; i++) {
    const v = Wallet.createRandom();
    voters.push(v);
    participants.push({ key: await v.getAddress(), weight: BigInt(1 << i) });
  }

  const census = new WeightedCensus();
  census.add(participants);

  const election = Election.from({
    title: 'Weighted yes/no',
    endDate: new Date(Date.now() + 60 * 60 * 1000),
    census,
    maxCensusSize: voters.length,
  });
  election.addQuestion('Approve proposal?', '', [
    { title: 'Yes', value: 0 },
    { title: 'No', value: 1 },
  ]);

  const electionId = await client.createElection(election);
  client.setElectionId(electionId);
  console.log(`Election created: ${client.explorerUrl}/processes/show/#/${electionId}`);

  await waitForElectionReady(client, electionId);

  // Cast votes: voters 0,2,4 say Yes; 1,3 say No
  await Promise.all(
    voters.map(async (voter, i) => {
      const c = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: voter, electionId });
      await c.submitVote(new Vote([i % 2]));
    }),
  );

  const result = await client.fetchElection();
  console.log('Tallies (weighted):', result.results);
  // Expect: yes = 1 + 4 + 16 = 21; no = 2 + 8 = 10
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
