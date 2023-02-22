/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Collection, Nft, Space, TransactionType } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
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
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nftId}`);
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
    return <Nft>(await nftDocRef.get()).data();
  };

  beforeEach(async () => {
    await helper.beforeEach();
    nft1 = await helper.createAndOrderNft();
    nft2 = await helper.createAndOrderNft();
    await helper.mintCollection();

    nft1 = await withdrawNftFunc(nft1.uid);
    nft2 = await withdrawNftFunc(nft2.uid);

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nft1.collection}`);
    collection = <Collection>(await collectionDocRef.get()).data();
  });

  it('Should deposit 2 nfts minted outside soonaverse', async () => {
    await admin.firestore().doc(`${COL.NFT}/${nft1.uid}`).delete();
    await admin.firestore().doc(`${COL.NFT}/${nft2.uid}`).delete();
    await admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`).delete();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    let depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      depositOrder.payload.targetAddress,
      undefined,
      nft1.mintingData!.nftId,
    );

    const nftQuery = admin.firestore().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await nftQuery.get();
      return snap.size === 1;
    });

    const nft1DocRef = admin.firestore().doc(`${COL.NFT}/${nft1.mintingData!.nftId}`);
    nft1 = <Nft>(await nft1DocRef.get()).data();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { space: nft1.space });
    const order = await testEnv.wrap(claimSpace)({});
    await helper.walletService!.send(
      helper.guardianAddress!,
      order.payload.targetAddress,
      order.payload.amount,
      {},
    );

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${nft1.space}`);
    await wait(async () => {
      const space = <Space>(await spaceDocRef.get()).data();
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
      return snap.size === 2;
    });

    const nft2DocRef = admin.firestore().doc(`${COL.NFT}/${nft2.mintingData!.nftId}`);
    nft2 = <Nft>(await nft2DocRef.get()).data();

    expect(nft1.collection).toBe(nft2.collection);
    expect(nft1.space).toBe(nft2.space);
    expect(nft2.hidden).toBe(false);

    const space = <Space>(await spaceDocRef.get()).data();
    expect(space.claimed).toBe(true);
  });
});
