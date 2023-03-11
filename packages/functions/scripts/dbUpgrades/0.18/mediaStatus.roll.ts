/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, MediaStatus } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const clearErroredMediaStatus = async (col: COL, app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  do {
    const query = db.collection(col).where('mediaStatus', '==', MediaStatus.ERROR).limit(500);
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, {
        mediaStatus: MediaStatus.PENDING_UPLOAD,
      });
    }
    await batch.commit();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (lastDoc);
};

export const roll = async (app: App) => {
  const collections = [COL.NFT, COL.TOKEN, COL.COLLECTION, COL.AWARD, COL.SPACE];
  for (const collection of collections) {
    await clearErroredMediaStatus(collection, app);
  }
};
