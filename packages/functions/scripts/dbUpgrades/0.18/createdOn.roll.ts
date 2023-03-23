/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const rollCreatedOn = async (app: App, col: COL) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  let count = 0;
  do {
    let query = db.collection(col).limit(200);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);
    const promises = snap.docs.map((doc) => {
      if (doc.createTime.seconds !== doc.data()?.createdOn?.seconds) {
        ++count;
        doc.ref.update({ createdOn: doc.createTime });
      }
    });
    await Promise.all(promises);
    console.log(count);
  } while (lastDoc);
};

export const roll = async (app: App) => {
  await rollCreatedOn(app, COL.COLLECTION);
  await rollCreatedOn(app, COL.NFT);
};
