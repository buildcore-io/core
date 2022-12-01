import { COL } from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import admin from '../admin.config';
import { uOn } from '../utils/dateTime.utils';

export const markAwardsAsCompleteCron = async () => {
  const qry = await admin
    .firestore()
    .collection(COL.AWARD)
    .where('completed', '==', false)
    .where('endDate', '<=', new Date())
    .get();
  if (qry.size > 0) {
    for (const t of qry.docs) {
      // Mark record as complete.
      functions.logger.info('mark-award-as-complete', 'Award marked as complete.', {
        awardId: t.data().uid,
      });

      await admin
        .firestore()
        .collection(COL.AWARD)
        .doc(t.data().uid)
        .update(
          uOn({
            completed: true,
          }),
        );
    }
  }

  // Finished.
  return null;
};
