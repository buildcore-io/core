/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { isEmpty, last } from 'lodash';

export const nftIsOwnedRoll = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.NFT).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        updatedOn: FieldValue.serverTimestamp(),
        isOwned: !isEmpty(doc.data()?.owner),
      });
    }
    await batch.commit();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (lastDoc);
};

export const roll = nftIsOwnedRoll;
