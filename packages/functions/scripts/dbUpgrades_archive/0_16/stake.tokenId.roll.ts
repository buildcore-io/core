/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

export const removeTokenIdFromStake = async () => {
  let lastDoc: any | undefined = undefined;
  let count = 0;
  do {
    let query = db.collection(COL.STAKE).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();
    snap.docs.forEach((d) => {
      if (d.data()?.tokenId) {
        batch.update(d.ref, {
          token: d.data().tokenId,
          tokenId: FieldValue.delete(),
        });
      }
    });
    await batch.commit();
    count += snap.docs.length;
  } while (lastDoc !== undefined);
  console.log(`${count} docs modified`);
};

removeTokenIdFromStake();
