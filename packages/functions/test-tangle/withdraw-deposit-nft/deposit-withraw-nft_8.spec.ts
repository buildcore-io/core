/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Collection, Nft, Transaction, TransactionType } from '@soonaverse/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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

  it('Should migrate nft to existing collection', async () => {
    const nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);

    await nftDocRef.delete();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap(depositNft)({});
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress);

    const nftQuery = soonDb().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await nftQuery.get();
      return snap.length > 0;
    });

    const snap = await nftQuery.get();
    const migratedNft = <Nft>snap[0];
    expect(migratedNft.collection).toBe(collection.uid);
  });
});
