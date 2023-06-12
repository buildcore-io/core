import { Award, COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../firebase/firestore/soondb';

export const processExpiredAwards = async () => {
  const snap = await soonDb()
    .collection(COL.AWARD)
    .where('completed', '==', false)
    .where('endDate', '<=', dayjs().toDate())
    .get<Award>();
  const promises = snap.map(async (award) => {
    const docRef = soonDb().doc(`${COL.AWARD}/${award.uid}`);
    await docRef.update({ completed: true });
  });
  await Promise.all(promises);
};
