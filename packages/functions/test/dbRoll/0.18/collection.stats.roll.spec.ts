import { COL, Collection, Nft, NftAvailable, NftStatus } from '@soonaverse/interfaces';
import { collectionStatsRoll } from '../../../scripts/dbUpgrades/0.18/collection.stat.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';
import { projectId, testEnv } from '../../set-up';

const collection = getRandomEthAddress();

const saveNfts = async (nfts: any[]) => {
  for (const nft of nfts) {
    await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).create(nft);
  }
};

const placeholderNft = {
  uid: getRandomEthAddress(),
  available: NftAvailable.UNAVAILABLE,
  collection,
  status: NftStatus.PRE_MINTED,
  placeholderNft: true,
  hidden: false,
};

const onSale = {
  uid: getRandomEthAddress(),
  available: NftAvailable.SALE,
  collection,
  status: NftStatus.PRE_MINTED,
  owner: 'asd',
};

const onAuction = {
  uid: getRandomEthAddress(),
  available: NftAvailable.AUCTION,
  collection,
  status: NftStatus.MINTED,
  owner: 'asd',
};

const onSaleAndAuction = {
  uid: getRandomEthAddress(),
  available: NftAvailable.AUCTION_AND_SALE,
  collection,
  status: NftStatus.PRE_MINTED,
  owner: 'asd',
};

const available = {
  uid: getRandomEthAddress(),
  available: NftAvailable.SALE,
  collection,
  status: NftStatus.PRE_MINTED,
  availableFrom: 'now',
};

describe('Collection stat roll', () => {
  it('Should set availableNfts and nftsOnAuction', async () => {
    await testEnv.firestore.clearFirestoreData(projectId);

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection}`);
    await collectionDocRef.create({ uid: collection, name: 'asd' });

    const nfts = [placeholderNft, onSale, onAuction, onSaleAndAuction, available];
    await saveNfts(nfts);

    await collectionStatsRoll(admin.app());
    await collectionStatsRoll(admin.app());

    const collectionData = <Collection>(await collectionDocRef.get()).data();
    expect(collectionData.availableNfts).toBe(1);
    expect(collectionData.nftsOnSale).toBe(2);
    expect(collectionData.nftsOnAuction).toBe(2);
    expect(collectionData.total).toBe(4);
  });

  it('Should set placeholderNft to hidden', async () => {
    await testEnv.firestore.clearFirestoreData(projectId);

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection}`);
    await collectionDocRef.create({
      uid: collection,
      name: 'asd',
      placeholderNft: placeholderNft.uid,
    });

    const nfts = [placeholderNft, onAuction];
    await saveNfts(nfts);

    await collectionStatsRoll(admin.app());
    await collectionStatsRoll(admin.app());

    const collectionData = <Collection>(await collectionDocRef.get()).data();
    expect(collectionData.availableNfts).toBe(0);
    expect(collectionData.nftsOnSale).toBe(0);
    expect(collectionData.nftsOnAuction).toBe(1);
    expect(collectionData.total).toBe(1);

    const placeholderNftDocRef = admin.firestore().doc(`${COL.NFT}/${placeholderNft.uid}`);
    const nft = <Nft>(await placeholderNftDocRef.get()).data();
    expect(nft.hidden).toBe(true);
  });
});
