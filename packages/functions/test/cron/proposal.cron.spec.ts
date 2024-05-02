import { database } from '@buildcore/database';
import { COL, ProposalType, SOON_PROJECT_ID } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { markExpiredProposalCompleted } from '../../src/cron/proposal.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Set proposal completed', () => {
  it('Should set proposal to completed', async () => {
    const member = getRandomEthAddress();
    const count = 600;
    const ids = Array.from(Array(count)).map(() => getRandomEthAddress());
    let batch = database().batch();
    for (let i = 0; i < count; ++i) {
      const proposal = {
        name: 'proposal',
        space: getRandomEthAddress(),
        description: 'name',
        type: ProposalType.ADD_GUARDIAN,
        questions: [],
        project: SOON_PROJECT_ID,
        uid: ids[i],
        settings: {
          startDate: dateToTimestamp(dayjs().subtract(10, 'd')),
          endDate: dateToTimestamp(dayjs().add(i < 550 ? -1 : 1, 'd')),
        },
        createdBy: member,
        completed: i < 550,
      };
      const docRef = database().doc(COL.PROPOSAL, proposal.uid);
      batch.create(docRef, proposal);
      if (i > 0 && i % 499 === 0) {
        await batch.commit();
        batch = database().batch();
      }
    }
    await batch.commit();
    await markExpiredProposalCompleted();
    const completed = await database()
      .collection(COL.PROPOSAL)
      .where('createdBy', '==', member)
      .where('completed', '==', true)
      .get();
    expect(completed.length).toBe(550);
    const inProgress = await database()
      .collection(COL.PROPOSAL)
      .where('createdBy', '==', member)
      .where('completed', '==', false)
      .get();
    expect(inProgress.length).toBe(50);
  });
});
