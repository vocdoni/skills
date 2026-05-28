/**
 * recipes/multichoice-vote.ts
 *
 * Multi-choice election: voters pick between MIN and MAX of the available
 * options. This example: pick exactly 2 of 4. No repeats, no abstain.
 */

import { Wallet } from '@ethersproject/wallet';
import {
  ElectionStatus,
  EnvOptions,
  MultiChoiceElection,
  PlainCensus,
  VocdoniSDKClient,
  Vote,
} from '@vocdoni/sdk';

const VOTERS_NUM = 10;
// Voter picks options 0 and 2 (e.g. "A" and "C")
const BALLOT = [0, 2];

async function waitForElectionReady(c: VocdoniSDKClient, id: string) {
  while ((await c.fetchElection(id)).status !== ElectionStatus.ONGOING) {
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

async function main() {
  const creator = Wallet.createRandom();
  const client = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: creator });
  await client.createAccount();

  const voters = Array.from({ length: VOTERS_NUM }, () => Wallet.createRandom());
  const census = new PlainCensus();
  voters.forEach((v) => census.add(v.address));

  const election = MultiChoiceElection.from({
    title: 'Pick exactly 2 of 4',
    endDate: new Date(Date.now() + 60 * 60 * 1000),
    census,
    maxCensusSize: voters.length,
    maxNumberOfChoices: 2,
    minNumberOfChoices: 2,
    canRepeatChoices: false,
    canAbstain: false,
  });
  election.addQuestion('Choose 2', '', [
    { title: 'A', value: 0 },
    { title: 'B', value: 1 },
    { title: 'C', value: 2 },
    { title: 'D', value: 3 },
  ]);

  const electionId = await client.createElection(election);
  client.setElectionId(electionId);
  console.log(`Election created: ${client.explorerUrl}/processes/show/#/${electionId}`);

  await waitForElectionReady(client, electionId);

  await Promise.all(
    voters.map(async (voter) => {
      const c = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: voter, electionId });
      await c.submitVote(new Vote(BALLOT));
    }),
  );

  const result = await client.fetchElection();
  console.log('Tallies:', result.results);
  // All voters picked A and C; expect counts for those columns.
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
