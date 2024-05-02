/* eslint-disable @typescript-eslint/no-explicit-any */
import { database, storage } from '@buildcore/database';
import {
  Bucket,
  COL,
  Collection,
  Nft,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

    const nftDocRef = database().doc(COL.NFT, nft.uid);
    mockWalletReturnValue(helper.guardian!, { nft: nft.uid });
    await testEnv.wrap(WEN_FUNC.withdrawNft);

    const query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.WITHDRAW_NFT)
      .where('payload_nft', '==', nft.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    nft = <Nft>await nftDocRef.get();
  });

  const validateStorageFileCount = (owner: string, uid: string) =>
    wait(async () => {
      const bucket = storage().bucket(Bucket.DEV);
      return (await bucket.getFilesCount(`${owner}/${uid}`)) > 0;
    });

  it('Should migrate media', async () => {
    const nftDocRef = database().doc(COL.NFT, nft.uid);

    await nftDocRef.delete();
    await database().doc(COL.COLLECTION, nft.collection).delete();

    mockWalletReturnValue(helper.guardian!, { network: helper.network });
    const depositOrder = await testEnv.wrap<Transaction>(WEN_FUNC.depositNft);
    await helper.sendNftToAddress(helper.guardianAddress!, depositOrder.payload.targetAddress!);

    const nftQuery = database().collection(COL.NFT).where('owner', '==', helper.guardian);
    await wait(async () => {
      const snap = await nftQuery.get();
      return snap.length > 0;
    });

    const snap = await nftQuery.get();
    const migratedNft = <Nft>snap[0];
    await validateStorageFileCount(helper.guardian!, migratedNft.uid);

    const migratedCollectionDocRef = database().doc(COL.COLLECTION, migratedNft.collection);
    const migratedCollection = <Collection>await migratedCollectionDocRef.get();
    await validateStorageFileCount(migratedCollection.space!, migratedCollection.uid);
  });
});
