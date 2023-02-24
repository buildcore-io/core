/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, TransactionAwardType, TransactionType } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

export const badgeTransactionRolls = async (app: App) => {
  const db = getFirestore(app);
  let size = 0;
  do {
    const snap = await db.collection(COL.TRANSACTION).where('type', '==', 'BADGE').limit(500).get();
    size = snap.size;

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      const data = {
        updatedOn: FieldValue.serverTimestamp(),
        type: TransactionType.AWARD,
        'payload.type': TransactionAwardType.BADGE,
        'payload.tokenReward': (doc.data()?.payload?.xp || 0) * XP_TO_SHIMMER,
      };
      batch.update(doc.ref, data);
    });
    await batch.commit();
  } while (size);
};

const XP_TO_SHIMMER = 1000000;

export const roll = badgeTransactionRolls;
