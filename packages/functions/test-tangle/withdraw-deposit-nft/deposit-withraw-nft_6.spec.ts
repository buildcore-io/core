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
import { soonDb } from '../../src/firebase/firestore/soondb';
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

    const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(withdrawNft)({});

    const query = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>await nftDocRef.get();

    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${nft.collection}`);
    collection = <Collection>await collectionDocRef.get();
  });

  it('Should deposit nft minted outside soonaverse and withdraw it', async () => {
    const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);

    await nftDocRef.delete();
    await soonDb().doc(`${COL.COLLECTION}/${nft.collection}`).delete();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    let depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const nftQuery = soonDb().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await nftQuery.get();
      return snap.length > 0;
    });

    const snap = await nftQuery.get();
    const migratedNft = <Nft>snap[0];

    expect(migratedNft.uid).toBe(nft.mintingData?.nftId!);
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
    expect(migratedNft.mediaStatus).toBe(MediaStatus.PENDING_UPLOAD);
    expect(migratedNft.media).toBeDefined();
    expect(migratedNft.properties.custom.value).toBe(1);
    expect(migratedNft.properties.customStat.value).toBe('customStat');

    const migratedCollectionDocRef = soonDb().doc(`${COL.COLLECTION}/${migratedNft.collection}`);
    const migratedCollection = <Collection>await migratedCollectionDocRef.get();
    expect(migratedCollection.space).toBe(migratedNft.space);
    expect(migratedCollection.uid).toBe(collection.mintingData?.nftId!);
    expect(migratedCollection.name).toBe(collection.name);
    expect(migratedCollection.description).toBe(collection.description);
    expect(migratedCollection.status).toBe(CollectionStatus.MINTED);
    expect(migratedCollection.mintingData?.network).toBe(collection.mintingData?.network);
    expect(migratedCollection.mintingData?.nftId).toBe(collection.mintingData?.nftId);
    expect(migratedCollection.mintingData?.aliasId).toBe(collection.mintingData?.aliasId);
    expect(migratedCollection.mediaStatus).toBe(MediaStatus.PENDING_UPLOAD);
    expect(migratedCollection.bannerUrl).toBeDefined();
    expect(migratedCollection.royaltiesFee).toBe(0.45);
    expect(migratedCollection.royaltiesSpace).toBe(getAddress(helper.royaltySpace!, Network.RMS));

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${migratedNft.space}`);
    const space = <Space>await spaceDocRef.get();
    expect(space.uid).toBeDefined();
    expect(space.name).toBe(migratedCollection.name);
    expect(space.collectionId).toBe(migratedCollection.mintingData?.nftId);
    expect(space.claimed).toBe(false);
    expect(space.avatarUrl).toBe(migratedCollection.bannerUrl);

    const nftId = nft.mintingData?.nftId;
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { nft: nftId });
    await testEnv.wrap(withdrawNft)({});
    const query = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload.nft', '==', nftId);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });

    const depositOrderDocRef = soonDb().doc(`${COL.TRANSACTION}/${depositOrder.uid}`);
    depositOrder = <Transaction>await depositOrderDocRef.get();
    expect(depositOrder.payload.nft).toBe(nftId);
  });
});
