import { database } from '@buildcore/database';
import { COL } from '@buildcore/interfaces';
import dayjs from 'dayjs';

export const processExpiredAwards = async () => {
  const snap = await database()
    .collection(COL.AWARD)
    .where('completed', '==', false)
    .where('endDate', '<=', dayjs().toDate())
    .get();
  const promises = snap.map(async (award) => {
    const docRef = database().doc(COL.AWARD, award.uid);
    await docRef.update({ completed: true });
  });
  await Promise.all(promises);
};
