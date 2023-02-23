/* eslint-disable @typescript-eslint/no-explicit-any */
import { AwardParticipantDeprecated, COL, SUB_COL } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

const BATCH_LIMIT = 500;

export const awardParticipantRoll = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any = undefined;

  do {
    let query = db.collection(COL.AWARD).limit(BATCH_LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const promises = snap.docs.map((doc) => updateAwardParticipants(db, doc.id));
    await Promise.all(promises);
  } while (lastDoc);
};

const updateAwardParticipants = async (db: FirebaseFirestore.Firestore, awardId: string) => {
  const awardDocRef = db.doc(`${COL.AWARD}/${awardId}`);
  let lastDoc: any = undefined;

  do {
    let query = awardDocRef.collection(SUB_COL.PARTICIPANTS).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();

    snap.docs.forEach((doc) => {
      const participant = doc.data() as AwardParticipantDeprecated;
      if (participant.xp) {
        const tokenReward = participant.xp * XP_TO_SHIMMER;
        batch.update(doc.ref, {
          updatedOn: FieldValue.serverTimestamp(),
          xp: FieldValue.delete(),
          tokenReward,
        });
      }
    });

    await batch.commit();
  } while (lastDoc);
};

const XP_TO_SHIMMER = 1000000;

export const roll = awardParticipantRoll;
