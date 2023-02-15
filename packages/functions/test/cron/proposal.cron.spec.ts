import { COL } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { makeExpiredProposalCompletedRoll } from '../../scripts/dbUpgrades/0_18/proposal.roll';
import admin from '../../src/admin.config';
import { markExpiredProposalCompleted } from '../../src/cron/proposal.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Set proposal completed', () => {
  it('Should set proposal to completed', async () => {
    const member = getRandomEthAddress();
    const count = 600;
    const ids = Array.from(Array(count)).map(() => getRandomEthAddress());

    let batch = admin.firestore().batch();
    for (let i = 0; i < count; ++i) {
      const proposal = {
        uid: ids[i],
        settings: {
          startDate: dateToTimestamp(dayjs().subtract(10, 'd')),
          endDate: dateToTimestamp(dayjs().add(i < 550 ? -1 : 1, 'd')),
        },
        createdBy: member,
      };
      const docRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposal.uid}`);
      batch.create(docRef, proposal);
      if (i > 0 && i % 499 === 0) {
        await batch.commit();
        batch = admin.firestore().batch();
      }
    }
    await batch.commit();

    await makeExpiredProposalCompletedRoll(admin.app());

    await markExpiredProposalCompleted();

    const completed = await admin
      .firestore()
      .collection(COL.PROPOSAL)
      .where('createdBy', '==', member)
      .where('completed', '==', true)
      .get();
    expect(completed.size).toBe(550);

    const inProgress = await admin
      .firestore()
      .collection(COL.PROPOSAL)
      .where('createdBy', '==', member)
      .where('completed', '==', false)
      .get();
    expect(inProgress.size).toBe(50);
  });
});
