import { database } from '@buildcore/database';
import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Nft,
  NftAccess,
  NftAvailable,
  SOON_PROJECT_ID,
} from '@buildcore/interfaces';
import { updateFloorPriceOnCollections } from '../../src/cron/collection.floor.price.cron';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Collection floor price', () => {
  it('Should set collection floor price', async () => {
    const collection = getRandomEthAddress();
    const collectionDocRef = database().doc(COL.COLLECTION, collection);
    await collectionDocRef.create({ project: SOON_PROJECT_ID, name: 'name' } as Collection);
    const promises = [
      NftAvailable.AUCTION,
      NftAvailable.SALE,
      NftAvailable.SALE,
      NftAvailable.AUCTION_AND_SALE,
    ].map(async (available, i) => {
      const nft = {
        project: SOON_PROJECT_ID,
        uid: getRandomEthAddress(),
        collection,
        available,
        saleAccess: NftAccess.OPEN,
        availablePrice: i * MIN_IOTA_AMOUNT,
      };
      await database()
        .doc(COL.NFT, nft.uid)
        .create(nft as Nft);
      return nft;
    });
    const nfts = await Promise.all(promises);
    await updateFloorPriceOnCollections();
    let collectionData = <Collection>await collectionDocRef.get();
    expect(collectionData.floorPrice).toBe(MIN_IOTA_AMOUNT);
    await database().doc(COL.NFT, nfts[1].uid).delete();
    await updateFloorPriceOnCollections();
    collectionData = <Collection>await collectionDocRef.get();
    expect(collectionData.floorPrice).toBe(2 * MIN_IOTA_AMOUNT);
  });
});
