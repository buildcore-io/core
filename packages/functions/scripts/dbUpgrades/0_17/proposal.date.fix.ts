/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Proposal } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const proposalDateFixes = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.PROPOSAL).limit(1000);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map(async (doc) => {
      const proposal = doc.data() as Proposal;
      const settings = proposal.settings;
      if (!settings.startDate?.seconds || !settings.endDate?.seconds) {
        await doc.ref.update({
          'settings.startDate': dayjs(settings.startDate).toDate(),
          'settings.endDate': dayjs(settings.endDate).toDate(),
        });
      }
    });
    await Promise.all(promises);
  } while (lastDoc);
};

export const roll = proposalDateFixes;
