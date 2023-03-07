import { COL, NftAvailable, NftStatus } from '@soonaverse/interfaces';
import { nftIsOwnedRoll } from '../../../scripts/dbUpgrades/0.18/nft.isOwned.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

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
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection}`);
    await collectionDocRef.create({ uid: collection, name: 'asd' });

    const nfts = [placeholderNft, onSale, onAuction, onSaleAndAuction, available];
    await saveNfts(nfts);

    await nftIsOwnedRoll(admin.app());

    for (const nft of [placeholderNft, available]) {
      const docRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
      const doc = await docRef.get();
      expect(doc.data()?.isOwned).toBe(false);
    }
    for (const nft of [onSale, onAuction, onSaleAndAuction]) {
      const docRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
      const doc = await docRef.get();
      expect(doc.data()?.isOwned).toBe(true);
    }
  });
});
