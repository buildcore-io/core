/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, MIN_IOTA_AMOUNT, Network, Nft } from '@build-5/interfaces';
import {
  AddressTypes,
  ED25519_ADDRESS_TYPE,
  INftAddress,
  NFT_ADDRESS_TYPE,
  REFERENCE_UNLOCK_TYPE,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import { cloneDeep } from 'lodash';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { depositNft } from '../../src/runtime/firebase/nft';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet.service';
import { packBasicOutput } from '../../src/utils/basic-output.utils';
import { indexToString, packEssence, packPayload, submitBlock } from '../../src/utils/block.utils';
import { EMPTY_NFT_ID, createNftOutput } from '../../src/utils/collection-minting-utils/nft.utils';
import { createUnlock, getTransactionPayloadHex } from '../../src/utils/smr.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
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

  it('Should migrate, nft has ipfs url ', async () => {
    await mintAndDeposit(
      {
        collectionName: 'test-collection',
        uri: 'https://ipfs.io/ipfs/QmPoYcVm9fx47YXNTkhpMEYSxCD3Bqh7PJYr7eo5YjLgiT',
        name: 'nft-name',
        description: 'nft-description',
      },
      {
        uri: 'https://shimmer.network',
        name: 'test',
        description: 'test',
      },
    );
    const query = build5Db().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
  });

  it('Should migrated collection not minted with alias and claim space', async () => {
    await mintAndDeposit(
      {
        collectionName: 'test-collection',
        uri: 'ipfs://bafkreiapx7kczhfukx34ldh3pxhdip5kgvh237dlhp55koefjo6tyupnj4',
        name: 'nft-name',
        description: 'nft-description',
      },
      {
        uri: 'ipfs://bafkreiapx7kczhfukx34ldh3pxhdip5kgvh237dlhp55koefjo6tyupnj4',
        name: 'test',
        description: 'test',
      },
    );
    const query = build5Db().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const snap = await query.get();
    const migratedNft = <Nft>snap[0];

    await helper.claimSpaceFunc(migratedNft.space);
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
    const collectionBlockState = await awaitLedgerInclusionState(
      collectionMintingBlock,
      Network.RMS,
    );
    if (collectionBlockState !== 'included') {
      fail();
    }

    const [nftMintingBlock, nftId] = await mintNft(helper.guardianAddress!, {
      collectionId,
      ...nftMetadata,
    });
    const nftBlockState = await awaitLedgerInclusionState(nftMintingBlock, Network.RMS);
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
  const wallet = await WalletService.newWallet(Network.RMS);
  const consumedOutputs = await wallet.getOutputs(address.bech32, [], false);
  const totalAmount = Object.values(consumedOutputs).reduce(
    (acc, act) => acc + Number(act.amount),
    0,
  );

  const issuerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex };
  const collectionOutput = createNftOutput(
    issuerAddress,
    issuerAddress,
    JSON.stringify(metadata),
    wallet.info,
  );

  const remainderAmount = totalAmount - Number(collectionOutput.amount);
  const remainder = packBasicOutput(address.bech32, remainderAmount, [], wallet.info);

  const inputs = Object.keys(consumedOutputs).map(TransactionHelper.inputFromOutputId);
  const inputsCommitment = TransactionHelper.getInputsCommitment(Object.values(consumedOutputs));

  const outputs = remainderAmount ? [collectionOutput, remainder] : [collectionOutput];
  const essence = packEssence(inputs, inputsCommitment, outputs, wallet, {});
  const unlocks: UnlockTypes[] = [createUnlock(essence, address.keyPair)];

  const payload = packPayload(essence, unlocks);
  const blockId = await submitBlock(wallet, payload);

  const collectionId = TransactionHelper.resolveIdFromOutputId(
    getTransactionPayloadHex(payload) + indexToString(0),
  );
  return [blockId, collectionId];
};

const mintNft = async (address: AddressDetails, metadata: any) => {
  const wallet = await WalletService.newWallet(Network.RMS);
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
      ? TransactionHelper.resolveIdFromOutputId(collectionOutputId)
      : collectionOutput.nftId;

  const issuerAddress: INftAddress = { type: NFT_ADDRESS_TYPE, nftId: collectionNftId };
  const ownerAddress: AddressTypes = { type: ED25519_ADDRESS_TYPE, pubKeyHash: address.hex };
  const nftOutput = createNftOutput(
    ownerAddress,
    issuerAddress,
    JSON.stringify(metadata),
    wallet.info,
  );

  const remainderAmount = totalAmount - Number(nftOutput.amount);
  const remainder = packBasicOutput(address.bech32, remainderAmount, [], wallet.info);

  const nextCollectionOutput = cloneDeep(collectionOutput);
  if (nextCollectionOutput.nftId === EMPTY_NFT_ID) {
    nextCollectionOutput.nftId = TransactionHelper.resolveIdFromOutputId(collectionOutputId);
  }

  const inputs = [collectionOutputId, ...Object.keys(consumedOutputs)].map(
    TransactionHelper.inputFromOutputId,
  );
  const inputsCommitment = TransactionHelper.getInputsCommitment([
    collectionOutput,
    ...Object.values(consumedOutputs),
  ]);

  const outputs = remainderAmount
    ? [nextCollectionOutput, nftOutput, remainder]
    : [nextCollectionOutput, nftOutput];
  const essence = packEssence(inputs, inputsCommitment, outputs, wallet, {});
  const unlocks: UnlockTypes[] = [
    createUnlock(essence, address.keyPair),
    { type: REFERENCE_UNLOCK_TYPE, reference: 0 },
  ];

  const payload = packPayload(essence, unlocks);
  const blockId = await submitBlock(wallet, payload);

  const nftId = TransactionHelper.resolveIdFromOutputId(
    getTransactionPayloadHex(payload) + indexToString(1),
  );
  return [blockId, nftId];
};
