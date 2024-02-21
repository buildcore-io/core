import { FirebaseApp } from '@build-5/database';
import { SUB_COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import admin from 'firebase-admin';
import { last } from 'lodash';
export const milestoneTransaction = async (app: FirebaseApp) => {
  const instance = app.getInstance() as admin.app.App;
  const firestore = instance.firestore();

  let lastDoc: any = undefined;
  let total = 0;
  do {
    const snap = await firestore
      .collectionGroup(SUB_COL.TRANSACTIONS)
      .where('processed', '==', false)
      .where('createdOn', '<=', dayjs().subtract(1, 'h').toDate())
      .orderBy('createdOn')
      .startAfter(lastDoc)
      .limit(100)
      .get();
    lastDoc = last(snap.docs);

    for (const doc of snap.docs) {
      await doc.ref.update({ updatedOn: dayjs().toDate() });
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    total += snap.docs.length;
    console.log(total);
  } while (lastDoc);
};

export const roll = milestoneTransaction;
