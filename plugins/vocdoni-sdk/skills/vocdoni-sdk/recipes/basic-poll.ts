/**
 * recipes/basic-poll.ts
 *
 * The minimum end-to-end Vocdoni flow:
 *   - create a creator wallet + account
 *   - build a tiny census of random voters
 *   - create a single-question election
 *   - wait for it to be ONGOING
 *   - cast every voter's vote
 *   - read results
 *
 * Runs against EnvOptions.STG (recommended testing env). Replace STG with PROD
 * for real elections (and supply a faucet package to createAccount).
 *
 * Usage:
 *   yarn add @vocdoni/sdk @ethersproject/wallet
 *   ts-node basic-poll.ts
 */

import { Wallet } from '@ethersproject/wallet';
import {
  Election,
  ElectionStatus,
  EnvOptions,
  PlainCensus,
  PublishedElection,
  VocdoniSDKClient,
  Vote,
} from '@vocdoni/sdk';

async function waitForElectionReady(client: VocdoniSDKClient, id: string): Promise<void> {
  while (true) {
    const e = await client.fetchElection(id);
    if (e.status === ElectionStatus.ONGOING) return;
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

async function main() {
  // 1. Creator client + account
  const creator = Wallet.createRandom();
  const client = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: creator });
  await client.createAccount(); // faucet runs automatically on STG/DEV

  // 2. Build a census of 5 random voters (all weight = 1)
  const voters: Wallet[] = [];
  const census = new PlainCensus();
  for (let i = 0; i < 5; i++) {
    const v = Wallet.createRandom();
    voters.push(v);
    census.add(await v.getAddress());
  }

  // 3. Create the election
  const election = Election.from({
    title: 'Is the sky blue?',
    description: 'A very important question',
    endDate: new Date(Date.now() + 60 * 60 * 1000),
    census,
    maxCensusSize: voters.length,
  });
  election.addQuestion('Pick one', '', [
    { title: 'Yes', value: 0 },
    { title: 'No', value: 1 },
  ]);

  const electionId = await client.createElection(election);
  client.setElectionId(electionId);
  console.log(`Election created: ${client.explorerUrl}/processes/show/#/${electionId}`);

  // 4. Wait for it to start accepting votes (block time ~10-13s)
  await waitForElectionReady(client, electionId);

  // 5. Cast each voter's vote in parallel — one client per voter
  await Promise.all(
    voters.map(async (voter, i) => {
      const c = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: voter, electionId });
      // Alternate Yes/No so we see both columns
      const voteId = await c.submitVote(new Vote([i % 2]));
      console.log(`voter ${i} voted: ${voteId}`);
    }),
  );

  // 6. Read results
  const result: PublishedElection = await client.fetchElection();
  console.log('Tallies:');
  result.questions.forEach((q, qi) => {
    console.log(`  ${q.title.default}`);
    q.choices.forEach((c, ci) => {
      console.log(`    ${c.title.default}: ${result.results[qi][ci]}`);
    });
  });
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
