/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bucket, COL, Collection, Nft, TransactionType } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { depositNft, withdrawNft } from '../../src/runtime/firebase/nft/index';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();
  let nft: Nft;

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
  });

  const validateStorageFileCount = (owner: string, uid: string) =>
    wait(async () => {
      const files = await admin
        .storage()
        .bucket(Bucket.DEV)
        .getFiles({
          directory: `${owner}/${uid}`,
          maxResults: 10,
        });
      return files[0].length > 0;
    });

  it('Should migrate media', async () => {
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);

    await nftDocRef.delete();
    await admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`).delete();

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
    await validateStorageFileCount(helper.guardian!, migratedNft.uid);

    const migratedCollectionDocRef = admin
      .firestore()
      .doc(`${COL.COLLECTION}/${migratedNft.collection}`);
    const migratedCollection = <Collection>(await migratedCollectionDocRef.get()).data();
    await validateStorageFileCount(migratedCollection.space, migratedCollection.uid);
  });
});
