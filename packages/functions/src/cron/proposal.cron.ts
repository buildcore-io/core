import { build5Db } from '@build-5/database';
import { COL, Proposal } from '@build-5/interfaces';
import dayjs from 'dayjs';

export const markExpiredProposalCompleted = async () => {
  let size = 0;
  do {
    const snap = await build5Db()
      .collection(COL.PROPOSAL)
      .where('completed', '==', false)
      .where('settings.endDate', '<', dayjs().toDate())
      .limit(500)
      .get<Proposal>();
    size = snap.length;

    const batch = build5Db().batch();
    snap.forEach((proposal) => {
      const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
      batch.update(proposalDocRef, { completed: true });
    });
    await batch.commit();
  } while (size);
};
