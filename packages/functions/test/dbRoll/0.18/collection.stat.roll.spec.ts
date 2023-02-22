import { COL, Collection, NftAvailable, NftStatus } from '@soonaverse/interfaces';
import { collectionStatsRoll } from '../../../scripts/dbUpgrades/0_18/collection.stats.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Collection stat roll', () => {
  it('Should set availableNfts and nftsOnAuction', async () => {
    const collection = getRandomEthAddress();
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection}`);
    await collectionDocRef.create({ uid: collection, name: 'asd' });
    const promises = Object.values(NftAvailable).map((available, index) => {
      const nft = getRandomEthAddress();
      const status = !index
        ? NftStatus.PRE_MINTED
        : index === 1
        ? NftStatus.MINTED
        : NftStatus.WITHDRAWN;
      return admin
        .firestore()
        .doc(`${COL.NFT}/${nft}`)
        .create({ uid: nft, available, collection, status });
    });
    await Promise.all(promises);

    const placeholderNft = {
      uid: getRandomEthAddress(),
      available: NftAvailable.UNAVAILABLE,
      collection,
      status: NftStatus.PRE_MINTED,
      placeholderNft: true,
    };
    await admin.firestore().doc(`${COL.NFT}/${placeholderNft.uid}`).create(placeholderNft);

    await collectionStatsRoll(admin.app());
    await collectionStatsRoll(admin.app());

    const collectionData = <Collection>(await collectionDocRef.get()).data();
    expect(collectionData.availableNfts).toBe(1);
    expect(collectionData.nftsOnAuction).toBe(2);
    expect(collectionData.total).toBe(2);
  });
});
