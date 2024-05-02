import { database } from '@buildcore/database';
import { COL } from '@buildcore/interfaces';
import dayjs from 'dayjs';

export const markExpiredProposalCompleted = async () => {
  let size = 0;
  do {
    const snap = await database()
      .collection(COL.PROPOSAL)
      .where('completed', '==', false)
      .where('settings_endDate', '<', dayjs().toDate())
      .limit(500)
      .get();
    size = snap.length;

    const batch = database().batch();
    for (const proposal of snap) {
      const proposalDocRef = database().doc(COL.PROPOSAL, proposal.uid);
      batch.update(proposalDocRef, { completed: true });
    }
    await batch.commit();
  } while (size);
};
