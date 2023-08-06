import { BaseRecord, COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../firebase/firestore/build5Db';

export const sessionCleanup = async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const expiredSessions = await build5Db()
      .collection(COL.KEEP_ALIVE)
      .where('updatedOn', '<=', dayjs().subtract(1, 'd').toDate())
      .limit(500)
      .select()
      .get<BaseRecord>();

    if (!expiredSessions.length) {
      break;
    }

    const batch = build5Db().batch();
    expiredSessions.forEach((s) => {
      const docRef = build5Db().doc(`${COL.KEEP_ALIVE}/${s.uid}`);
      batch.delete(docRef);
    });
    await batch.commit();
  }
};
