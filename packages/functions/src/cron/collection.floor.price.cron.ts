import { COL, Collection, Nft, NftAccess, NftAvailable } from '@build-5/interfaces';
import { head, last } from 'lodash';
import { build5Db, getSnapshot } from '../firebase/firestore/build5Db';

export const updateFloorPriceOnCollections = async () => {
  let lastUid = '';
  do {
    const lastDoc = await getSnapshot(COL.COLLECTION, lastUid);
    const query = build5Db().collection(COL.COLLECTION).limit(400).startAfter(lastDoc);
    const snap = await query.get<Collection>();
    lastUid = last(snap)?.uid || '';

    const batch = build5Db().batch();
    for (const collection of snap) {
      const floorPrice = await updateCollectionFloorPrice(collection);
      if (floorPrice !== undefined) {
        const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collection.uid}`);
        batch.update(collectionDocRef, { floorPrice });
      }
    }
    await batch.commit();

    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (lastUid);
};

const updateCollectionFloorPrice = async (collection: Collection) => {
  const snap = await build5Db()
    .collection(COL.NFT)
    .where('collection', '==', collection.uid)
    .where('saleAccess', '==', NftAccess.OPEN)
    .where('available', 'in', [NftAvailable.SALE, NftAvailable.AUCTION_AND_SALE])
    .orderBy('availablePrice')
    .limit(1)
    .get<Nft>();
  return head(snap)?.availablePrice || undefined;
};
