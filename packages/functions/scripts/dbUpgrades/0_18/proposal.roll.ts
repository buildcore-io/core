/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Proposal } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const makeExpiredProposalCompletedRoll = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.PROPOSAL).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      const proposal = doc.data() as Proposal;
      batch.update(doc.ref, {
        uOn: FieldValue.serverTimestamp(),
        completed: dayjs(proposal.settings.endDate?.toDate()).isBefore(dayjs()),
      });
    });
    await batch.commit();
  } while (lastDoc);
};

export const roll = makeExpiredProposalCompletedRoll;
