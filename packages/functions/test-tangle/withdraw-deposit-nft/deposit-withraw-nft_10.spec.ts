/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AddressTypes,
  ED25519_ADDRESS_TYPE,
  INftAddress,
  NFT_ADDRESS_TYPE,
  REFERENCE_UNLOCK_TYPE,
  TransactionHelper,
  UnlockTypes,
} from '@iota/iota.js-next';
import {
  COL,
  Collection,
  CollectionStatus,
  MediaStatus,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  Transaction,
  TransactionType,
  UnsoldMintingOptions,
  WenError,
} from '@soonaverse/interfaces';
import { cloneDeep } from 'lodash';
import admin from '../../src/admin.config';
import { mintCollection } from '../../src/runtime/firebase/collection';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { NftWallet } from '../../src/services/wallet/NftWallet';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { packBasicOutput } from '../../src/utils/basic-output.utils';
import { indexToString, packEssence, packPayload, submitBlock } from '../../src/utils/block.utils';
import { createNftOutput, EMPTY_NFT_ID } from '../../src/utils/collection-minting-utils/nft.utils';
import { createUnlock, getTransactionPayloadHex } from '../../src/utils/smr.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitLedgerInclusionState, requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

const HUGE_CID = 'bafybeiae5ai264zyte7qtnrelp5aplwkgb22yurwnwcqlugwwkxwlyoh4i';

describe('Collection minting', () => {
  const helper = new Helper();
  let nft: Nft;
  let collection: Collection;

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should credit, ipfs invalid', async () => {
    await mintWithCustomNftCID((ipfsMedia) =>
      Array.from(Array(ipfsMedia.length))
        .map(() => 'a')
        .join(''),
    );

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian)
      .where('type', '==', TransactionType.CREDIT_NFT);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1;
    });
    const snap = await query.get();
    const credit = <Transaction>snap.docs[0].data();
    expect(credit.payload.response.code).toBe(2117);
    expect(credit.payload.response.message).toBe('Could not get data from ipfs');
  });

  it('Should credit, ipfs invalid', async () => {
    await mintWithCustomNftCID(() => HUGE_CID);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian)
      .where('type', '==', TransactionType.CREDIT_NFT);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1;
    });
    const snap = await query.get();
    const credit = <Transaction>snap.docs[0].data();
    expect(credit.payload.response.code).toBe(2118);
    expect(credit.payload.response.message).toBe('Maximum media size is 100 MB');
  });

  it('Should throw, nft not irc27', async () => {
    const credit = await mintDepositAndCredit(
      { collectionName: 'test-collection' },
      { name: 'test' },
    );
    expect(credit.payload.response.code).toBe(WenError.nft_not_irc27_compilant.code);
    expect(credit.payload.response.message).toBe(WenError.nft_not_irc27_compilant.key);
  });

  it('Should throw, collection not irc27', async () => {
    const credit = await mintDepositAndCredit(
      {
        collectionName: 'test-collection',
        uri: 'uri',
        name: 'nft-name',
        description: 'nft-description',
      },
      { name: 'test' },
    );
    expect(credit.payload.response.code).toBe(WenError.collection_not_irc27_compilant.code);
    expect(credit.payload.response.message).toBe(WenError.collection_not_irc27_compilant.key);
  });

  it('Should throw, collection not minted by alias', async () => {
    const credit = await mintDepositAndCredit(
      {
        collectionName: 'test-collection',
        uri: 'uri',
        name: 'nft-name',
        description: 'nft-description',
      },
      { uri: 'test', name: 'test', description: 'test' },
    );

    expect(credit.payload.response.code).toBe(WenError.collection_was_not_minted_with_alias.code);
    expect(credit.payload.response.message).toBe(WenError.collection_was_not_minted_with_alias.key);
  });

  const mintWithCustomNftCID = async (func: (ipfsMedia: string) => string) => {
    nft = await helper.createAndOrderNft();
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection!,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap(mintCollection)({});
    await requestFundsFromFaucet(
      helper.network,
      helper.guardianAddress!.bech32,
      10 * MIN_IOTA_AMOUNT,
    );
    await helper.walletService!.send(
      helper.guardianAddress!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
      {},
    );
    await MnemonicService.store(helper.guardianAddress!.bech32, helper.guardianAddress!.mnemonic);

    await wait(
      async () => {
        const nft = <Nft>(await nftDocRef.get()).data();
        if (nft.mediaStatus === MediaStatus.PENDING_UPLOAD) {
          await nftDocRef.update({ ipfsMedia: func(nft.ipfsMedia) });
        }
        return nft.mediaStatus === MediaStatus.PENDING_UPLOAD;
      },
      undefined,
      200,
    );

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`);
    await wait(async () => {
      collection = <Collection>(await collectionDocRef.get()).data();
      return collection.status === CollectionStatus.MINTED;
    });

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(withdrawNft)({});

    let query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>(await nftDocRef.get()).data();

    await nftDocRef.delete();
    await admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`).delete();
  };

  const mintDepositAndCredit = async (nftMetadata: any, collectionMetadata: any) => {
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
    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.guardian)
      .where('type', '==', TransactionType.CREDIT_NFT);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    const snap = await query.get();
    return <Transaction>snap.docs[0].data();
  };
});

const mintCustomCollection = async (address: AddressDetails, metadata: any) => {
  const wallet = (await WalletService.newWallet(Network.RMS)) as SmrWallet;
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
  const wallet = (await WalletService.newWallet(Network.RMS)) as SmrWallet;
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
