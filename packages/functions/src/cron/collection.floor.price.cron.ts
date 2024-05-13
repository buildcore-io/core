import { database } from '@buildcore/database';
import { COL, Collection } from '@buildcore/interfaces';
import { last } from 'lodash';

const LIMIT = 500;
export const updateFloorPriceOnCollections = async () => {
  let lastDoc: Collection | undefined = undefined;
  do {
    const snap: Collection[] = await database()
      .collection(COL.COLLECTION)
      .startAfter(lastDoc)
      .limit(LIMIT)
      .get();
    lastDoc = last(snap);

    const promises = snap.map(async (col) => {
      const floorPrice = await database().collection(COL.NFT).getFloorPrice(col.uid);
      await database().doc(COL.COLLECTION, col.uid).update({ floorPrice });
    });
    await Promise.all(promises);
  } while (lastDoc);
};
