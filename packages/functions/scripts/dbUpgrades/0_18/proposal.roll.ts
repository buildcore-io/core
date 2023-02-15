/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Proposal } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import { uOn } from '../../../src/utils/dateTime.utils';

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
      batch.update(
        doc.ref,
        uOn({ completed: dayjs(proposal.settings.endDate?.toDate()).isBefore(dayjs()) }),
      );
    });
    await batch.commit();
  } while (lastDoc);
};

export const roll = makeExpiredProposalCompletedRoll;
