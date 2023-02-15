import { COL } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../admin.config';
import { uOn } from '../utils/dateTime.utils';

export const markExpiredProposalCompleted = async () => {
  let size = 0;
  do {
    const snap = await admin
      .firestore()
      .collection(COL.PROPOSAL)
      .where('completed', '==', false)
      .where('settins.endDate', '<', dayjs().toDate())
      .limit(500)
      .get();
    size = snap.size;

    const batch = admin.firestore().batch();
    snap.docs.forEach((doc) => batch.update(doc.ref, uOn({ completed: true })));
    await batch.commit();
  } while (size);
};
