import { COL, Collection, Nft, NftAccess, NftAvailable } from '@soonaverse/interfaces';
import { last } from 'lodash';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';

export const updateFloorPriceOnCollections = async () => {
  let lastUid = '';
  do {
    const lastDoc = await getSnapshot(COL.COLLECTION, lastUid);
    const query = soonDb().collection(COL.COLLECTION).limit(500).startAfter(lastDoc);
    const snap = await query.get<Collection>();
    lastUid = last(snap)?.uid || '';

    for (const collection of snap) {
      await updateCollectionFloorPrice(collection);
    }
  } while (lastUid);
};

const updateCollectionFloorPrice = async (colletion: Collection) => {
  const snap = await soonDb()
    .collection(COL.NFT)
    .where('collection', '==', colletion.uid)
    .where('saleAccess', '==', NftAccess.OPEN)
    .where('available', 'in', [NftAvailable.SALE, NftAvailable.AUCTION_AND_SALE])
    .orderBy('availablePrice')
    .limit(1)
    .get<Nft>();
  if (!snap.length) {
    return;
  }

  const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${colletion.uid}`);
  await collectionDocRef.update({ floorPrice: snap[0].availablePrice });
};
