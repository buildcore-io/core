/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, SUB_COL } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';

export const memberSpacesRollFix = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.SPACE).limit(1000);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);
    const promises = snap.docs.map((doc) => updateSpaceMembers(db, doc.id));
    await Promise.all(promises);
  } while (lastDoc);
};

const updateSpaceMembers = async (db: FirebaseFirestore.Firestore, space: string) => {
  const spaceMembersSnap = await db
    .collection(COL.SPACE)
    .doc(space)
    .collection(SUB_COL.MEMBERS)
    .get();
  const promises = spaceMembersSnap.docs.map((doc) => {
    const memberDocRef = db.doc(`${COL.MEMBER}/${doc.id}`);
    return memberDocRef.set(
      { spaces: { [space]: { uid: space, isMember: true } } },
      { merge: true },
    );
  });
  await Promise.all(promises);
};

export const roll = memberSpacesRollFix;
