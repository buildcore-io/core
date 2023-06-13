import { COL, Collection, MIN_IOTA_AMOUNT, NftAccess, NftAvailable } from '@build-5/interfaces';
import { updateFloorPriceOnCollections } from '../../src/cron/collection.floor.price.cron';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Collection floor price', () => {
  it('Should set collection floor price', async () => {
    const collection = getRandomEthAddress();
    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collection}`);
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
        saleAccess: NftAccess.OPEN,
        availablePrice: i * MIN_IOTA_AMOUNT,
      };
      await build5Db().doc(`${COL.NFT}/${nft.uid}`).create(nft);
      return nft;
    });
    const nfts = await Promise.all(promises);

    await updateFloorPriceOnCollections();

    let collectionData = <Collection>await collectionDocRef.get();
    expect(collectionData.floorPrice).toBe(MIN_IOTA_AMOUNT);

    await build5Db().doc(`${COL.NFT}/${nfts[1].uid}`).delete();
    await updateFloorPriceOnCollections();
    collectionData = <Collection>await collectionDocRef.get();
    expect(collectionData.floorPrice).toBe(2 * MIN_IOTA_AMOUNT);
  });
});
