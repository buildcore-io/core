/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COL,
  Collection,
  CollectionStatus,
  MediaStatus,
  Network,
  Nft,
  NftStatus,
  Space,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft/index';
import { getAddress } from '../../src/utils/address.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Nft depositing', () => {
  const helper = new Helper();
  let nft: Nft;
  let collection: Collection;

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
    nft = await helper.createAndOrderNft();
    await helper.mintCollection();

    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(withdrawNft)({});

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>(await nftDocRef.get()).data();

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`);
    collection = <Collection>(await collectionDocRef.get()).data();
  });

  it('Should deposit nft minted outside soonaverse and withdraw it', async () => {
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);

    await nftDocRef.delete();
    await admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`).delete();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    let depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const nftQuery = admin.firestore().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await nftQuery.get();
      return snap.size > 0;
    });

    const snap = await nftQuery.get();
    const migratedNft = <Nft>snap.docs[0].data();

    expect(migratedNft.uid).toBe(nft.mintingData?.nftId!);
    expect(migratedNft.ipfsMedia).toBe(nft.ipfsMedia);
    expect(migratedNft.name).toBe(nft.name);
    expect(migratedNft.description).toBe(nft.description);
    expect(migratedNft.collection).toBe(collection.mintingData?.nftId!);
    expect(migratedNft.space).toBeDefined();
    expect(migratedNft.owner).toBe(helper.guardian);
    expect(migratedNft.isOwned).toBe(true);
    expect(migratedNft.depositData?.network).toBe(nft.mintingData?.network);
    expect(migratedNft.depositData?.nftId).toBe(nft.mintingData?.nftId);
    expect(migratedNft.depositData?.address).toBe(depositOrder.payload.targetAddress);
    expect(migratedNft.status).toBe(NftStatus.MINTED);
    expect(migratedNft.mediaStatus).toBe(MediaStatus.UPLOADED);
    expect(migratedNft.media).toBeDefined();
    expect(migratedNft.properties.custom.value).toBe(1);
    expect(migratedNft.properties.customStat.value).toBe('customStat');

    const migratedCollectionDocRef = admin
      .firestore()
      .doc(`${COL.COLLECTION}/${migratedNft.collection}`);
    const migratedCollection = <Collection>(await migratedCollectionDocRef.get()).data();
    expect(migratedCollection.space).toBe(migratedNft.space);
    expect(migratedCollection.uid).toBe(collection.mintingData?.nftId!);
    expect(migratedCollection.name).toBe(collection.name);
    expect(migratedCollection.description).toBe(collection.description);
    expect(migratedCollection.ipfsMedia).toBe(collection.ipfsMedia);
    expect(migratedCollection.status).toBe(CollectionStatus.MINTED);
    expect(migratedCollection.mintingData?.network).toBe(collection.mintingData?.network);
    expect(migratedCollection.mintingData?.nftId).toBe(collection.mintingData?.nftId);
    expect(migratedCollection.mintingData?.aliasId).toBe(collection.mintingData?.aliasId);
    expect(migratedCollection.mediaStatus).toBe(MediaStatus.UPLOADED);
    expect(migratedCollection.bannerUrl).toBeDefined();
    expect(migratedCollection.royaltiesFee).toBe(0.45);
    expect(migratedCollection.royaltiesSpace).toBe(getAddress(helper.royaltySpace!, Network.RMS));

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${migratedNft.space}`);
    const space = <Space>(await spaceDocRef.get()).data();
    expect(space.uid).toBeDefined();
    expect(space.name).toBe(migratedCollection.name);
    expect(space.collectionId).toBe(migratedCollection.mintingData?.nftId);
    expect(space.claimed).toBe(false);
    expect(space.avatarUrl).toBe(migratedCollection.bannerUrl);

    const nftId = nft.mintingData?.nftId;
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nftId });
    await testEnv.wrap(withdrawNft)({});
    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nftId);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1 && snap.docs[0].data()?.payload?.walletReference?.confirmed;
    });

    const depositOrderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${depositOrder.uid}`);
    depositOrder = <Transaction>(await depositOrderDocRef.get()).data();
    expect(depositOrder.payload.nft).toBe(nftId);
  });
});
