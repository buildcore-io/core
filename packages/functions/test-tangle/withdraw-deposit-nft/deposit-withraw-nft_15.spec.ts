/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import { COL, MIN_IOTA_AMOUNT, Network } from '@build-5/interfaces';
import {
  Ed25519Address,
  NftAddress,
  NftOutputBuilderParams,
  Output,
  ReferenceUnlock,
  TransactionPayload,
  UTXOInput,
  Unlock,
  Utils,
} from '@iota/sdk';
import { cloneDeep } from 'lodash';
import { depositNft } from '../../src/runtime/firebase/nft';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { packBasicOutput } from '../../src/utils/basic-output.utils';
import { createUnlock, packEssence, submitBlock } from '../../src/utils/block.utils';
import { EMPTY_NFT_ID, createNftOutput } from '../../src/utils/collection-minting-utils/nft.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { MEDIA, getWallet, testEnv } from '../../test/set-up';
import { awaitLedgerInclusionState, requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should deposit nft with missing description metadata', async () => {
    await mintAndDeposit(
      {
        collectionName: 'test-collection',
        uri: MEDIA,
        name: 'nft-name',
      },
      {
        uri: 'https://shimmer.network',
        name: 'test',
      },
    );
    const query = build5Db().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
  });

  const mintAndDeposit = async (nftMetadata: any, collectionMetadata: any) => {
    await requestFundsFromFaucet(
      helper.network,
      helper.guardianAddress!.bech32,
      10 * MIN_IOTA_AMOUNT,
    );
    const [collectionMintingBlock, collectionId] = await mintCustomCollection(
      helper.guardianAddress!,
      collectionMetadata,
    );
    const collectionBlockState = await awaitLedgerInclusionState(collectionMintingBlock);
    if (collectionBlockState !== 'included') {
      fail();
    }

    const [nftMintingBlock, nftId] = await mintNft(helper.guardianAddress!, {
      collectionId,
      ...nftMetadata,
    });
    const nftBlockState = await awaitLedgerInclusionState(nftMintingBlock);
    if (nftBlockState !== 'included') {
      fail();
    }

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      depositOrder.payload.targetAddress,
      undefined,
      nftId,
    );
  };
});

const mintCustomCollection = async (address: AddressDetails, metadata: any) => {
  const wallet = await getWallet(Network.RMS);
  const consumedOutputs = await wallet.getOutputs(address.bech32, [], false);
  const totalAmount = Object.values(consumedOutputs).reduce(
    (acc, act) => acc + Number(act.amount),
    0,
  );

  const issuerAddress = new Ed25519Address(address.hex);
  const collectionOutput = await createNftOutput(
    wallet,
    issuerAddress,
    issuerAddress,
    JSON.stringify(metadata),
  );

  const remainderAmount = totalAmount - Number(collectionOutput.amount);
  const remainder = await packBasicOutput(wallet, address.bech32, remainderAmount, {});

  const inputs = Object.keys(consumedOutputs).map(UTXOInput.fromOutputId);
  const inputsCommitment = Utils.computeInputsCommitment(Object.values(consumedOutputs));

  const outputs = remainderAmount ? [collectionOutput, remainder] : [collectionOutput];
  const essence = await packEssence(wallet, inputs, inputsCommitment, outputs, {});
  const unlocks = [await createUnlock(essence, address)];

  const payload = new TransactionPayload(essence, unlocks);
  const blockId = await submitBlock(wallet, essence, unlocks);
  await build5Db().doc(`blocks/${blockId}`).create({ blockId });

  const collectionOutputId = Utils.computeOutputId(Utils.transactionId(payload), 0);
  const collectionId = Utils.computeNftId(collectionOutputId);
  return [blockId, collectionId];
};

const mintNft = async (address: AddressDetails, metadata: any) => {
  const wallet = await getWallet(Network.RMS);
  const nftWallet = new NftWallet(wallet);

  const consumedOutputs = await wallet.getOutputs(address.bech32, [], false);
  const totalAmount = Object.values(consumedOutputs).reduce(
    (acc, act) => acc + Number(act.amount),
    0,
  );

  const collectionOutputs = await nftWallet.getNftOutputs(undefined, address.bech32, []);
  const [collectionOutputId, collectionOutput] = Object.entries(collectionOutputs)[0];
  const collectionNftId =
    collectionOutput.nftId === EMPTY_NFT_ID
      ? Utils.computeNftId(collectionOutputId)
      : collectionOutput.nftId;

  const issuerAddress = new NftAddress(collectionNftId);
  const ownerAddress = new Ed25519Address(address.hex);
  const nftOutput = await createNftOutput(
    wallet,
    ownerAddress,
    issuerAddress,
    JSON.stringify(metadata),
  );

  const remainderAmount = totalAmount - Number(nftOutput.amount);
  const remainder = await packBasicOutput(wallet, address.bech32, remainderAmount, {});

  const nextCollectionOutput: NftOutputBuilderParams = cloneDeep(collectionOutput);
  if (nextCollectionOutput.nftId === EMPTY_NFT_ID) {
    nextCollectionOutput.nftId = Utils.computeNftId(collectionOutputId);
  }

  const inputs = [collectionOutputId, ...Object.keys(consumedOutputs)].map(UTXOInput.fromOutputId);
  const inputsCommitment = Utils.computeInputsCommitment([
    collectionOutput,
    ...Object.values(consumedOutputs),
  ]);

  const outputs: Output[] = [await wallet.client.buildNftOutput(nextCollectionOutput), nftOutput];
  if (remainderAmount) {
    outputs.push(remainder);
  }
  const essence = await packEssence(wallet, inputs, inputsCommitment, outputs, {});
  const unlocks: Unlock[] = [await createUnlock(essence, address), new ReferenceUnlock(0)];

  const payload = new TransactionPayload(essence, unlocks);
  const blockId = await submitBlock(wallet, essence, unlocks);
  await build5Db().doc(`blocks/${blockId}`).create({ blockId });

  const nftOutputId = Utils.computeOutputId(Utils.transactionId(payload), 1);
  const nftId = Utils.computeNftId(nftOutputId);
  return [blockId, nftId];
};
