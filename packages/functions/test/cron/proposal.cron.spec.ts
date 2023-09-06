import { build5Db } from '@build-5/database';
import { COL } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { markExpiredProposalCompleted } from '../../src/cron/proposal.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Set proposal completed', () => {
  it('Should set proposal to completed', async () => {
    const member = getRandomEthAddress();
    const count = 600;
    const ids = Array.from(Array(count)).map(() => getRandomEthAddress());

    let batch = build5Db().batch();
    for (let i = 0; i < count; ++i) {
      const proposal = {
        uid: ids[i],
        settings: {
          startDate: dateToTimestamp(dayjs().subtract(10, 'd')),
          endDate: dateToTimestamp(dayjs().add(i < 550 ? -1 : 1, 'd')),
        },
        createdBy: member,
        completed: i < 550,
      };
      const docRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
      batch.create(docRef, proposal);
      if (i > 0 && i % 499 === 0) {
        await batch.commit();
        batch = build5Db().batch();
      }
    }
    await batch.commit();

    await markExpiredProposalCompleted();

    const completed = await build5Db()
      .collection(COL.PROPOSAL)
      .where('createdBy', '==', member)
      .where('completed', '==', true)
      .get();
    expect(completed.length).toBe(550);

    const inProgress = await build5Db()
      .collection(COL.PROPOSAL)
      .where('createdBy', '==', member)
      .where('completed', '==', false)
      .get();
    expect(inProgress.length).toBe(50);
  });
});
