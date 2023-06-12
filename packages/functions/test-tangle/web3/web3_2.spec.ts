import { COL, Collection, MediaStatus, Space } from '@build-5/interfaces';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { collectionToIpfsMetadata, nftToIpfsMetadata } from '../../src/utils/car.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, wait } from '../../test/controls/common';
import { CollectionMintHelper } from '../collection-minting/Helper';

let walletSpy: any;

describe('Web3 cron test', () => {
  const collectionHelper = new CollectionMintHelper();

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    await cleanupPendingUploads();
  });

  it('Should set metadata.json correctly', async () => {
    await collectionHelper.beforeAll();
    await collectionHelper.beforeEach();

    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${collectionHelper.collection}`);
    const collection = <Collection>await collectionDocRef.get();
    const nft = collectionHelper.createDummyNft(collection.uid, collectionHelper.space!.uid) as any;

    const nftMetadata = nftToIpfsMetadata(collection, nft);
    expect(nftMetadata.name).toBe(nft.name);
    expect(nftMetadata.description).toBe(nft.description);
    expect(nftMetadata.author).toBe(nft.createdBy);
    expect(nftMetadata.space).toBe(nft.space);
    expect(nftMetadata.royaltySpace).toBe(collection.royaltiesSpace);
    expect(nftMetadata.uid).toBe(nft.uid);
    expect(nftMetadata.attributes).toEqual([
      { trait_type: 'custom', value: 'custom' },
      { trait_type: 'customStat', value: 'customStat' },
    ]);
    expect(nftMetadata.collectionId).toBe(collection.uid);

    const collectionMetadata = collectionToIpfsMetadata(collection);
    expect(collectionMetadata.name).toBe(collection.name);
    expect(collectionMetadata.description).toBe(collection.description);
    expect(collectionMetadata.author).toBe(collection.createdBy);
    expect(collectionMetadata.space).toBe(collection.space);
    expect(collectionMetadata.royaltySpace).toBe(collection.royaltiesSpace);
    expect(collectionMetadata.uid).toBe(collection.uid);
  });

  it('Should upload space media', async () => {
    const guardian = await createMember(walletSpy);
    let space = await createSpace(walletSpy, guardian);

    await uploadMediaToWeb3();

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space.uid}`);
    await wait(async () => {
      space = <Space>await spaceDocRef.get();
      return space.mediaStatus === MediaStatus.UPLOADED;
    });
  });

  afterEach(async () => {
    await cleanupPendingUploads();
  });
});

const cleanupPendingUploads = async () => {
  for (const col of [COL.TOKEN, COL.NFT, COL.COLLECTION]) {
    const snap = await pendingUploadsQuery(col).get<Record<string, unknown>>();
    const promises = snap.map((d) => {
      const docRef = soonDb().doc(`${col}/${d.uid}`);
      return docRef.update({ mediaStatus: soonDb().deleteField() });
    });
    await Promise.all(promises);
  }
};

const pendingUploadsQuery = (col: COL) =>
  soonDb().collection(col).where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD);
