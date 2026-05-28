/**
 * recipes/approval-vote.ts
 *
 * Approval voting: voters approve any subset of N options.
 * Each approved option gets +1; unapproved gets 0.
 *
 * In this example: 10 voters all approve options 1 and 3 of [Green, Blue, Pink, Orange].
 * Expected tallies: [0, 10, 0, 10] for [Green, Blue, Pink, Orange].
 */

import { Wallet } from '@ethersproject/wallet';
import {
  ApprovalElection,
  ElectionStatus,
  EnvOptions,
  PlainCensus,
  VocdoniSDKClient,
  Vote,
} from '@vocdoni/sdk';

const VOTERS_NUM = 10;
const APPROVAL_BALLOT = [0, 1, 0, 1]; // approve Blue and Orange

async function waitForElectionReady(c: VocdoniSDKClient, id: string) {
  while ((await c.fetchElection(id)).status !== ElectionStatus.ONGOING) {
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

async function main() {
  const creator = Wallet.createRandom();
  const client = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: creator });
  await client.createAccount();

  const voters: Wallet[] = Array.from({ length: VOTERS_NUM }, () => Wallet.createRandom());
  const census = new PlainCensus();
  voters.forEach((v) => census.add(v.address));

  const election = ApprovalElection.from({
    title: 'Pick your favourite colours (approve any subset)',
    endDate: new Date(Date.now() + 60 * 60 * 1000),
    census,
    maxCensusSize: voters.length,
  });
  election.addQuestion('Favourite colours', '', [
    { title: 'Green', value: 0 },
    { title: 'Blue', value: 1 },
    { title: 'Pink', value: 2 },
    { title: 'Orange', value: 3 },
  ]);

  const electionId = await client.createElection(election);
  client.setElectionId(electionId);
  console.log(`Election created: ${client.explorerUrl}/processes/show/#/${electionId}`);

  await waitForElectionReady(client, electionId);

  // All voters submit the same approval ballot for clarity
  await Promise.all(
    voters.map(async (voter) => {
      const c = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: voter, electionId });
      await c.submitVote(new Vote(APPROVAL_BALLOT));
    }),
  );

  const result = await client.fetchElection();
  console.log('Tallies:', result.results);
  // Expect: [['0', '10', '0', '10']]
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
