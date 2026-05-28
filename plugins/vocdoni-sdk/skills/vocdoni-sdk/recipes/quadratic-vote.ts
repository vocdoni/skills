/**
 * recipes/quadratic-vote.ts
 *
 * Quadratic voting: each voter has a credit budget; cost of allocating N
 * credits to an option is N^quadraticCost (default 2).
 *
 * In this example: 10 voters with 14 credits each, each allocates [1, 0, 3, 2].
 *   Cost per ballot: 1² + 0² + 3² + 2² = 14 (uses full budget).
 *   Expected per-option tally: [10, 0, 30, 20].
 *
 * Note: WeightedCensus assigns the credit budget per voter when
 * useCensusWeightAsBudget = true.
 */

import { Wallet } from '@ethersproject/wallet';
import {
  ElectionStatus,
  EnvOptions,
  QuadraticElection,
  VocdoniSDKClient,
  Vote,
  WeightedCensus,
} from '@vocdoni/sdk';

const VOTERS_NUM = 10;
const CREDITS = 14;
const BALLOT = [1, 0, 3, 2];

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
  const census = new WeightedCensus();
  census.add(voters.map((v) => ({ key: v.address, weight: BigInt(CREDITS) })));

  const election = QuadraticElection.from({
    title: 'Quadratic funding round',
    description: 'Which NGO should receive credits?',
    endDate: new Date(Date.now() + 60 * 60 * 1000),
    census,
    useCensusWeightAsBudget: true, // voter's census weight IS their credit budget
    quadraticCost: 2,
    maxCensusSize: voters.length,
  });
  election.addQuestion('Select NGOs', 'Quadratic vote', [
    { title: 'Greenpeace', value: 0 },
    { title: 'Red Cross', value: 1 },
    { title: 'MSF', value: 2 },
    { title: 'Amnesty', value: 3 },
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
  // Expect: [['10', '0', '30', '20']]  (sum of allocated credits per option)
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
