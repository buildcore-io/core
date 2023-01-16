/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, SUB_COL } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const setRankAvg = async (app: App, col: COL.TOKEN | COL.COLLECTION) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  let count = 0;

  do {
    let query = db.collection(col).limit(250);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (!data.rankCount) {
        return;
      }

      const rankAvg = Number((data.rankSum / data.rankCount).toFixed(3));
      batch.update(doc.ref, uOn({ rankAvg }));

      const statsDocRef = doc.ref.collection(SUB_COL.STATS).doc(doc.id);
      batch.set(
        statsDocRef,
        uOn({ ranks: { count: data.rankCount, sum: data.rankSum, avg: rankAvg } }),
        { merge: true },
      );

      ++count;
    });
    await batch.commit();
  } while (lastDoc);
  console.log(`${count} order updated`);
  return count;
};

const uOn = <T>(o: T): T => ({ ...o, updatedOn: FieldValue.serverTimestamp() });

export const roll = async (app: App) => {
  await setRankAvg(app, COL.TOKEN);
  await setRankAvg(app, COL.COLLECTION);
};
