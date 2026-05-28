/**
 * recipes/ranked-vote.ts
 *
 * Ranked / linear-weighted-choice election: voters rank each option uniquely
 * from 0..N-1. Higher number = higher rank in the result tally (since each
 * option-cell holds the number of voters who gave that option that rank).
 *
 * In this example: 10 voters all submit the rank vector [2, 3, 0, 1, 4] over
 *   [Bitcoin, Ethereum, Monero, Zcash, Polkadot].
 * Expected result matrix (5 options × 5 possible ranks):
 *   Bitcoin:  [0, 0, 10, 0, 0]
 *   Ethereum: [0, 0,  0,10, 0]
 *   Monero:   [10,0, 0, 0, 0]
 *   Zcash:    [0,10, 0, 0, 0]
 *   Polkadot: [0, 0, 0, 0,10]
 */

import { Wallet } from '@ethersproject/wallet';
import {
  Election,
  ElectionStatus,
  EnvOptions,
  IVoteType,
  PlainCensus,
  VocdoniSDKClient,
  Vote,
} from '@vocdoni/sdk';

const VOTERS_NUM = 10;
const NUM_OPTIONS = 5;
const RANKED_BALLOT = [2, 3, 0, 1, 4]; // distinct ranks 0..4

const VOTE_OPTIONS: IVoteType = {
  uniqueChoices: true, // every option must get a unique rank
  costFromWeight: false,
  maxCount: NUM_OPTIONS,
  maxValue: NUM_OPTIONS - 1, // ranks are 0..NUM_OPTIONS-1
  maxTotalCost: 0,
};

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

  const election = Election.from({
    title: 'Rank your favourite blockchains',
    endDate: new Date(Date.now() + 60 * 60 * 1000),
    census,
    voteType: VOTE_OPTIONS,
    maxCensusSize: voters.length,
  });
  election.addQuestion('Rank these', '', [
    { title: 'Bitcoin', value: 0 },
    { title: 'Ethereum', value: 1 },
    { title: 'Monero', value: 2 },
    { title: 'Zcash', value: 3 },
    { title: 'Polkadot', value: 4 },
  ]);

  const electionId = await client.createElection(election);
  client.setElectionId(electionId);
  console.log(`Election created: ${client.explorerUrl}/processes/show/#/${electionId}`);

  await waitForElectionReady(client, electionId);

  await Promise.all(
    voters.map(async (voter) => {
      const c = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: voter, electionId });
      await c.submitVote(new Vote(RANKED_BALLOT));
    }),
  );

  const result = await client.fetchElection();
  console.log('Tallies (per option, per rank):', result.results);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
