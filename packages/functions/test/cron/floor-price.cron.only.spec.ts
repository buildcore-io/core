import { COL, Collection, MIN_IOTA_AMOUNT, NftAvailable } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { updateFloorPriceOnCollections } from '../../src/cron/collection.floor.price.cron';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Collection floor price', () => {
  it('Should set collection floor price', async () => {
    const collection = getRandomEthAddress();
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection}`);
    await collectionDocRef.create({ uid: collection, name: 'asd' });

    const promises = [
      NftAvailable.AUCTION,
      NftAvailable.SALE,
      NftAvailable.SALE,
      NftAvailable.AUCTION_AND_SALE,
    ].map(async (available, i) => {
      const nft = {
        uid: getRandomEthAddress(),
        collection,
        available,
        availablePrice: i * MIN_IOTA_AMOUNT,
      };
      await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).create(nft);
      return nft;
    });
    const nfts = await Promise.all(promises);

    await updateFloorPriceOnCollections();

    let collectionData = <Collection>(await collectionDocRef.get()).data();
    expect(collectionData.floorPrice).toBe(MIN_IOTA_AMOUNT);

    await admin.firestore().doc(`${COL.NFT}/${nfts[1].uid}`).delete();
    await updateFloorPriceOnCollections();
    collectionData = <Collection>(await collectionDocRef.get()).data();
    expect(collectionData.floorPrice).toBe(2 * MIN_IOTA_AMOUNT);
  });
});