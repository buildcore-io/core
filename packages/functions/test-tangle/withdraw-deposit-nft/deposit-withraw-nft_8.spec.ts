/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Collection, Nft, TransactionType } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft/index';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Collection minting', () => {
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

  it('Should migrate nft to existing collection', async () => {
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);

    await nftDocRef.delete();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const nftQuery = admin.firestore().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await nftQuery.get();
      return snap.size > 0;
    });

    const snap = await nftQuery.get();
    const migratedNft = <Nft>snap.docs[0].data();
    expect(migratedNft.collection).toBe(collection.uid);
  });
});
