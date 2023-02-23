/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, TransactionAwardType, TransactionType } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const badgeTransactionRolls = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;

  do {
    let query = db.collection(COL.TRANSACTION).where('type', '==', 'BADGE').limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      const data = {
        type: TransactionType.AWARD,
        payload: {
          type: TransactionAwardType.BADGE,
          tokenReward: (doc.data()?.payload?.xp || 0) * XP_TO_SHIMMER,
        },
      };
      batch.set(doc.ref, data, { merge: true });
    });
    await batch.commit();
  } while (lastDoc);
};

const XP_TO_SHIMMER = 1000000;

export const roll = badgeTransactionRolls;
