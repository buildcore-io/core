import { FirebaseApp, Firestore } from '@build-5/database';
import { COL, Proposal } from '@build-5/interfaces';
import { last } from 'lodash';

export const proposalRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);
  let lastDocId = '';

  do {
    const lastDoc = lastDocId
      ? await db.doc(`${COL.PROPOSAL}/${lastDocId}`).getSnapshot()
      : undefined;
    const proposals = await db
      .collection(COL.PROPOSAL)
      .startAfter(lastDoc)
      .limit(500)
      .get<Proposal>();
    lastDocId = last(proposals)?.uid || '';

    const batch = db.batch();

    proposals.forEach((p) => {
      if (p.completed !== undefined) {
        return;
      }
      const docRef = db.doc(`${COL.PROPOSAL}/${p.uid}`);
      batch.update(docRef, { completed: p.completed || false });
    });

    await batch.commit();
  } while (lastDocId);
};

export const roll = proposalRoll;
