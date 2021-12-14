import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { COL } from '../../functions/interfaces/models/base';

export const markAwardsAsComplete: functions.CloudFunction<any> = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.AWARD)
                    .where('completed', '==', false)
                    .where('endDate', '<=', new Date()).get();
  if (qry.size > 0) {
    for (const t of qry.docs) {
        // Mark record as complete.
        functions.logger.info('mark-award-as-complete', "Award marked as complete.", {
          awardId: t.data().uid
        });

        await admin.firestore().collection(COL.AWARD).doc(t.data().uid).update({
          completed: true
        });
    }
  }

  // Finished.
  return null;
});
