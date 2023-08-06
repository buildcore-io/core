import { COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { sessionCleanup } from '../../src/cron/session.cron';
import admin, { build5App } from '../../src/firebase/app/build5App';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Expired sessions', () => {
  const db: admin.firestore.Firestore = build5App().getInstance().firestore();

  it('Should remove expires sessions', async () => {
    const uids = [getRandomEthAddress(), getRandomEthAddress()];

    const sessionDocRef = build5Db().doc(`${COL.KEEP_ALIVE}/${uids[0]}`);
    await sessionDocRef.create({});
    await db
      .doc(`${COL.KEEP_ALIVE}/${uids[0]}`)
      .update({ updatedOn: dayjs().subtract(2, 'd').toDate() });

    const session2DocRef = build5Db().doc(`${COL.KEEP_ALIVE}/${uids[1]}`);
    await session2DocRef.create({});

    await sessionCleanup();

    const sessions = await sessionDocRef.get();
    expect(sessions).toBeUndefined();
    const sessions2 = await session2DocRef.get();
    expect(sessions2).toBeDefined();
  });
});
