/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Collection, Nft, Space, Transaction, TransactionType } from '@build-5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft/index';
import { claimSpace } from '../../src/runtime/firebase/space';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Nft depositing', () => {
  const helper = new Helper();
  let nft1: Nft;
  let nft2: Nft;
  let collection: Collection;

  beforeAll(async () => {
    await helper.beforeAll();
  });

  const withdrawNftFunc = async (nftId: string) => {
    const nftDocRef = soonDb().doc(`${COL.NFT}/${nftId}`);
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
    return <Nft>await nftDocRef.get();
  };

  beforeEach(async () => {
    await helper.beforeEach();
    nft1 = await helper.createAndOrderNft();
    nft2 = await helper.createAndOrderNft();
    await helper.mintCollection();

    nft1 = await withdrawNftFunc(nft1.uid);
    nft2 = await withdrawNftFunc(nft2.uid);

    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${nft1.collection}`);
    collection = <Collection>await collectionDocRef.get();
  });

  it('Should deposit 2 nfts minted outside build-5', async () => {
    await soonDb().doc(`${COL.NFT}/${nft1.uid}`).delete();
    await soonDb().doc(`${COL.NFT}/${nft2.uid}`).delete();
    await soonDb().doc(`${COL.COLLECTION}/${collection.uid}`).delete();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    let depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      depositOrder.payload.targetAddress,
      undefined,
      nft1.mintingData!.nftId,
    );

    const nftQuery = soonDb().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await nftQuery.get();
      return snap.length === 1;
    });

    const nft1DocRef = soonDb().doc(`${COL.NFT}/${nft1.mintingData!.nftId}`);
    nft1 = <Nft>await nft1DocRef.get();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { space: nft1.space });
    const order = await testEnv.wrap(claimSpace)({});
    await helper.walletService!.send(
      helper.guardianAddress!,
      order.payload.targetAddress,
      order.payload.amount,
      {},
    );

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${nft1.space}`);
    await wait(async () => {
      const space = <Space>await spaceDocRef.get();
      return space.claimed || false;
    });

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      depositOrder.payload.targetAddress,
      undefined,
      nft2.mintingData!.nftId,
    );

    await wait(async () => {
      const snap = await nftQuery.get();
      return snap.length === 2;
    });

    const nft2DocRef = soonDb().doc(`${COL.NFT}/${nft2.mintingData!.nftId}`);
    nft2 = <Nft>await nft2DocRef.get();

    expect(nft1.collection).toBe(nft2.collection);
    expect(nft1.space).toBe(nft2.space);
    expect(nft2.hidden).toBe(false);

    const space = <Space>await spaceDocRef.get();
    expect(space.claimed).toBe(true);
  });
});
