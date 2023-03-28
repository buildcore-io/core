import { COL, Proposal } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../firebase/firestore/soondb';

export const markExpiredProposalCompleted = async () => {
  let size = 0;
  do {
    const snap = await soonDb()
      .collection(COL.PROPOSAL)
      .where('completed', '==', false)
      .where('settings.endDate', '<', dayjs().toDate())
      .limit(500)
      .get<Proposal>();
    size = snap.length;

    const batch = soonDb().batch();
    snap.forEach((proposal) => {
      const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal.uid}`);
      batch.update(proposalDocRef, { completed: true });
    });
    await batch.commit();
  } while (size);
};
