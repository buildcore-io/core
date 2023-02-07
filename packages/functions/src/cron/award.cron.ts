import { COL } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../admin.config';
import { uOn } from '../utils/dateTime.utils';

export const processExpiredAwards = async () => {
  const snap = await admin
    .firestore()
    .collection(COL.AWARD)
    .where('completed', '==', false)
    .where('endDate', '<=', dayjs().toDate())
    .get();
  const promises = snap.docs.map((doc) => doc.ref.update(uOn({ completed: true })));
  await Promise.all(promises);
};
