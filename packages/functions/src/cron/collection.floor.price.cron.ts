import { COL, Collection, NftAccess, NftAvailable } from '@soonaverse/interfaces';
import { last } from 'lodash';
import admin from '../admin.config';
import { LastDocType } from '../utils/common.utils';
import { uOn } from '../utils/dateTime.utils';

export const updateFloorPriceOnCollections = async () => {
  let lastDoc: LastDocType | undefined = undefined;
  do {
    let query = admin.firestore().collection(COL.COLLECTION).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    for (const doc of snap.docs) {
      await updateCollectionFloorPrice(doc.data() as Collection);
    }
  } while (lastDoc);
};

const updateCollectionFloorPrice = async (colletion: Collection) => {
  const snap = await admin
    .firestore()
    .collection(COL.NFT)
    .where('collection', '==', colletion.uid)
    .where('saleAccess', '==', NftAccess.OPEN)
    .where('available', 'in', [NftAvailable.SALE, NftAvailable.AUCTION_AND_SALE])
    .orderBy('availablePrice')
    .limit(1)
    .get();
  if (!snap.size) {
    return;
  }

  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${colletion.uid}`);
  await collectionDocRef.update(uOn({ floorPrice: snap.docs[0].data().availablePrice }));
};
