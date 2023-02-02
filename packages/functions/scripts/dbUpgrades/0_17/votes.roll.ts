/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, SUB_COL } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const setVotesOnParent = async (app: App, col: COL.COLLECTION | COL.TOKEN) => {
  const db = getFirestore(app);
  let lastDoc: any = undefined;
  do {
    let query = db.collection(col).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map((doc) => updateVotes(db, col, doc.id));
    await Promise.all(promises);
  } while (lastDoc);
};

const updateVotes = async (db: FirebaseFirestore.Firestore, col: COL, uid: string) =>
  db.runTransaction(async (transaction) => {
    const parentDocRef = db.doc(`${col}/${uid}`);
    const statsDocRef = parentDocRef.collection(SUB_COL.STATS).doc(uid);
    const statsDoc = await transaction.get(statsDocRef);
    transaction.update(parentDocRef, { votes: statsDoc.data()?.votes || {} });
  });

export const roll = async (app: App) => {
  await setVotesOnParent(app, COL.COLLECTION);
  await setVotesOnParent(app, COL.TOKEN);
};
