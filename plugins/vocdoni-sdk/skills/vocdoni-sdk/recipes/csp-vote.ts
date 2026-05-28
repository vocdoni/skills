/**
 * recipes/csp-vote.ts
 *
 * CSP-gated voting: eligibility is decided by an external authority that
 * issues blind signatures. The chain only knows the CSP's public key and URL.
 *
 * The exact auth shape (cspStep payloads) is CSP-specific. The shape here
 * mirrors the README's example CSP (arithmetic challenge). Replace with what
 * your CSP requires.
 *
 * Requires a running CSP server reachable at CSP_URL with public key CSP_PUBKEY.
 * For a real reference implementation see https://github.com/vocdoni/blind-csp.
 */

import { Wallet } from '@ethersproject/wallet';
import {
  CspCensus,
  Election,
  ElectionStatus,
  EnvOptions,
  ICspFinalStepResponse,
  ICspIntermediateStepResponse,
  VocdoniSDKClient,
  Vote,
} from '@vocdoni/sdk';

const CSP_URL = process.env.CSP_URL ?? 'https://csp.example.com/v1';
const CSP_PUBKEY = process.env.CSP_PUBKEY ?? '0x04abcdef...';

async function waitForElectionReady(c: VocdoniSDKClient, id: string) {
  while ((await c.fetchElection(id)).status !== ElectionStatus.ONGOING) {
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

async function main() {
  // 1. Creator side: build an election with a CspCensus
  const creator = Wallet.createRandom();
  const adminClient = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: creator });
  await adminClient.createAccount();

  const census = new CspCensus(CSP_PUBKEY, CSP_URL);

  const election = Election.from({
    title: 'CSP-gated election',
    description: 'Only voters approved by the CSP can vote.',
    endDate: new Date(Date.now() + 60 * 60 * 1000),
    census,
  });
  election.addQuestion('Approve?', '', [
    { title: 'Yes', value: 0 },
    { title: 'No', value: 1 },
  ]);

  const electionId = await adminClient.createElection(election);
  console.log(`Election created: ${adminClient.explorerUrl}/processes/show/#/${electionId}`);
  await waitForElectionReady(adminClient, electionId);

  // 2. Voter side: run the CSP auth protocol, then submit a CspVote.
  const voter = Wallet.createRandom();
  const voterClient = new VocdoniSDKClient({
    env: EnvOptions.STG,
    wallet: voter,
    electionId,
  });

  // Step 0: provide whatever your CSP expects (here: a username).
  const step0 = (await voterClient.cspStep(0, ['Alice'])) as ICspIntermediateStepResponse;

  // Step 1: respond to the CSP's challenge. The README's reference CSP
  // expects you to sum the numbers in step0.response. Adjust to your CSP.
  const sum = step0.response.reduce((acc, v) => +acc + +v, 0).toString();
  const step1 = (await voterClient.cspStep(1, [sum], step0.authToken)) as ICspFinalStepResponse;

  // Get the blind signature on the voter's address for this election.
  const signature = await voterClient.cspSign(voter.address, step1.token);

  // Build and submit the CSP vote.
  const cspVote = voterClient.cspVote(new Vote([0]), signature);
  const voteId = await voterClient.submitVote(cspVote);

  console.log(`Voted (id: ${voteId}). Verify: ${voterClient.explorerUrl}/verify/#/${voteId}`);

  const result = await adminClient.fetchElection(electionId);
  console.log('Tallies:', result.results);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
