/* eslint-disable @typescript-eslint/no-explicit-any */
import { AwardParticipant, COL, SUB_COL } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const awardUppercaseRoll = async (app: App, awardId: string) => {
  const db = getFirestore(app);

  const awardDocRef = db.doc(`${COL.AWARD}/${awardId}`);
  const snap = await awardDocRef.collection(SUB_COL.PARTICIPANTS).get();

  const participants = snap.docs.map((d) => d.data() as AwardParticipant);
  const promises = participants.map((p) => rollParticipant(db, p, participants));
  await Promise.all(promises);
};

const rollParticipant = async (
  db: FirebaseFirestore.Firestore,
  participant: AwardParticipant,
  participants: AwardParticipant[],
) => {
  if (!/[A-Z]/.test(participant.uid)) {
    return;
  }
  const hasLowercase =
    participants.find((p) => p.uid === participant.uid.toLowerCase()) !== undefined;

  const awardDocRef = db.doc(`${COL.AWARD}/${participant.parentId}`);
  const uppercaseParticipantDocRef = awardDocRef
    .collection(SUB_COL.PARTICIPANTS)
    .doc(participant.uid);

  const batch = db.batch();
  batch.delete(uppercaseParticipantDocRef);

  if (!hasLowercase) {
    const participantDocRef = awardDocRef
      .collection(SUB_COL.PARTICIPANTS)
      .doc(participant.uid.toLowerCase());
    batch.create(participantDocRef, { ...participant, uid: participant.uid.toLowerCase() });
  }

  const queries = [
    db
      .collection(COL.AIRDROP)
      .where('member', '==', participant.uid)
      .where('award', '==', participant.parentId),
    db
      .collection(COL.TRANSACTION)
      .where('member', '==', participant.uid)
      .where('payload.award', '==', participant.parentId),
  ];

  for (const query of queries) {
    const snap = await query.get();
    snap.docs.forEach((doc) => {
      if (hasLowercase) {
        batch.delete(doc.ref);
      } else {
        batch.update(doc.ref, { member: participant.uid.toLowerCase() });
      }
    });
  }

  await batch.commit();
};

export const roll = (app: App) =>
  awardUppercaseRoll(app, '0xd3904836042c2c465f27568b2f507a41b395b060');
