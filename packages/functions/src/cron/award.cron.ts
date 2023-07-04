import { Award, COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../firebase/firestore/build5Db';

export const processExpiredAwards = async () => {
  const snap = await build5Db()
    .collection(COL.AWARD)
    .where('completed', '==', false)
    .where('endDate', '<=', dayjs().toDate())
    .get<Award>();
  const promises = snap.map(async (award) => {
    const docRef = build5Db().doc(`${COL.AWARD}/${award.uid}`);
    await docRef.update({ completed: true });
  });
  await Promise.all(promises);
};
