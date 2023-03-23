/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const rollCreatedOn = async (app: App, col: COL) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;

  do {
    let query = db.collection(col).limit(200);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    for (const doc of snap.docs) {
      await doc.ref.update({ createdOn: doc.createTime });
    }
  } while (lastDoc);
};

export const roll = async (app: App) => {
  await rollCreatedOn(app, COL.COLLECTION);
  await rollCreatedOn(app, COL.NFT);
};
