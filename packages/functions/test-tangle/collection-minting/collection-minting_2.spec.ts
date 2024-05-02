import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  CollectionStatus,
  MediaStatus,
  SOON_PROJECT_ID,
  Transaction,
  UnsoldMintingOptions,
  WEN_FUNC,
} from '@build-5/interfaces';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { wait } from '../../test/controls/common';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { CollectionMintHelper } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should retry minting when prepare ipfs failed', async () => {
    const count = 5;
    const collectionDocRef = build5Db().doc(COL.COLLECTION, helper.collection!);
    await collectionDocRef.update({ total: count });

    const promises = Array.from(Array(count)).map(async () => {
      const nft = helper.createDummyNft(helper.collection!);
      await build5Db()
        .doc(COL.NFT, nft.uid)
        .create({
          ...nft,
          availableFrom: dateToTimestamp(nft.availableFrom),
          project: SOON_PROJECT_ID,
        } as any);
      return (await build5Db().doc(COL.NFT, nft.uid).get())!;
    });
    const nfts = await Promise.all(promises);

    const request = {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    };

    mockWalletReturnValue(helper.guardian!, request);
    const collectionMintOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintCollection);
    for (let i = 0; i < nfts.length; ++i) {
      const docRef = build5Db().doc(COL.NFT, nfts[i].uid);
      await docRef.update({ media: i > 2 ? 'name' : MEDIA });
    }
    await requestFundsFromFaucet(
      helper.network!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
    );

    const nftQuery = build5Db()
      .collection(COL.NFT)
      .where('collection', '==', helper.collection!)
      .where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD);
    await wait(async () => {
      const nfts = await nftQuery.get();
      return nfts.length === 3;
    });
    const pendingUploadNfts = await nftQuery.limit(2).get();
    for (const nft of pendingUploadNfts) {
      const docRef = build5Db().doc(COL.NFT, nft.uid);
      await docRef.update({ mediaStatus: MediaStatus.UPLOADED });
    }
    await collectionDocRef.update({ mintingData_nftMediaToUpload: 3 });
    for (const nft of nfts) {
      const docRef = build5Db().doc(COL.NFT, nft.uid);
      await docRef.update({ media: MEDIA });
    }

    await collectionDocRef.update({ status: CollectionStatus.PRE_MINTED });
    await collectionDocRef.update({ status: CollectionStatus.MINTING });
    await wait(async () => {
      const data = <Collection>await collectionDocRef.get();
      return data.status === CollectionStatus.MINTED;
    });
    const data = <Collection>await collectionDocRef.get();
    expect(data.mintingData?.nftMediaToUpload).toBe(3);
    expect(data.mintingData?.nftMediaToPrepare).toBe(0);
  });
});
