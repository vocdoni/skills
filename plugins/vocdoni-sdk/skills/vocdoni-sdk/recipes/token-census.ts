/**
 * recipes/token-census.ts
 *
 * Create an election whose voters are holders of an on-chain ERC20/721 token,
 * using Census3 to materialise the merkle census.
 *
 * Two flavours shown:
 *   A) Single-token census    — createTokenCensus
 *   B) Strategy-based census  — createStrategyCensus (with a predicate)
 *
 * Holders cast votes from their own wallets like a normal Vocdoni election.
 */

import { Wallet } from '@ethersproject/wallet';
import {
  Election,
  ElectionStatus,
  EnvOptions,
  StrategyCensus,
  TokenCensus,
  VocdoniCensus3Client,
  VocdoniSDKClient,
  Vote,
} from '@vocdoni/sdk';

async function waitForElectionReady(c: VocdoniSDKClient, id: string) {
  while ((await c.fetchElection(id)).status !== ElectionStatus.ONGOING) {
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

async function createSingleTokenCensus(census3: VocdoniCensus3Client): Promise<TokenCensus> {
  // YAM token on Ethereum mainnet (chainID 1). Replace as needed.
  const TOKEN = '0x0AaCfbeC6a24756c20D41914F2caba817C0d8521';
  const CHAIN_ID = 1;

  // Verify the token is synced before building a census against it.
  const tokenInfo = await census3.getToken(TOKEN, CHAIN_ID);
  if (!tokenInfo.status.synced) {
    throw new Error(`Token ${TOKEN} not yet synced (progress ${tokenInfo.status.progress}%)`);
  }

  // Long-running: polls the Census3 queue until the merkle tree is ready.
  return census3.createTokenCensus(TOKEN, CHAIN_ID);
}

async function createStrategyTokenCensus(census3: VocdoniCensus3Client): Promise<StrategyCensus> {
  // Example: holders of (YAM AND API3) on Ethereum mainnet.
  const strategyId = await census3.createStrategy(
    `demo-${Date.now()}`,
    '(YAM AND API3)',
    {
      YAM:  { ID: '0x0AaCfbeC6a24756c20D41914F2caba817C0d8521', chainID: 1, minBalance: '1' },
      API3: { ID: '0x0b38210ea11411557c13457D4dA7dC6ea731B88a', chainID: 1, minBalance: '1' },
    },
  );

  const estimate = await census3.getStrategyEstimation(strategyId);
  console.log(`Strategy ${strategyId} estimated size: ${estimate.size}`);

  return census3.createStrategyCensus(strategyId);
}

async function main() {
  // Use PROD for real token data. Switch to STG/DEV if you have testnet tokens.
  const census3 = new VocdoniCensus3Client({
    env: EnvOptions.PROD,
    tx_wait: { retry_time: 3000, attempts: 30 }, // larger censuses take longer
  });

  const creator = Wallet.createRandom();
  const vocdoni = new VocdoniSDKClient({ env: EnvOptions.PROD, wallet: creator });
  // On PROD you must pass a real faucet package:
  //   await vocdoni.createAccount({ faucetPackage: '<base64>' });
  // Use STG instead for an env where createAccount() auto-funds:
  // const vocdoni = new VocdoniSDKClient({ env: EnvOptions.STG, wallet: creator });
  await vocdoni.createAccount();

  // Pick one flavour:
  const census = await createSingleTokenCensus(census3);
  // const census = await createStrategyTokenCensus(census3);

  const election = Election.from({
    title: 'Token holders vote',
    description: `Holders of ${census.token.symbol} (chain ${census.token.chainID})`,
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    census, // TokenCensus or StrategyCensus extends PublishedCensus
    maxCensusSize: census.size, // pin to the snapshot size
  });

  election.addQuestion('Proposal X?', '', [
    { title: 'Yes', value: 0 },
    { title: 'No',  value: 1 },
  ]);

  const electionId = await vocdoni.createElection(election);
  console.log(`Election created: ${vocdoni.explorerUrl}/processes/show/#/${electionId}`);

  // Voting: each holder uses their own wallet (the one that holds the token).
  // The SDK will fetch the relevant proof from the census published by Census3.
  //
  //   const voterClient = new VocdoniSDKClient({
  //     env: EnvOptions.PROD,
  //     wallet: holderWallet,
  //     electionId,
  //   });
  //   await voterClient.submitVote(new Vote([0]));
  //
  // Voting weight = holder's token balance at the snapshot block.

  await waitForElectionReady(vocdoni, electionId);
  console.log('Election is ONGOING; holders can now vote.');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
