/* eslint-disable @typescript-eslint/no-explicit-any */

import { COL, PublicCollections, PublicSubCollections, SUB_COL, Space } from '@build-5/interfaces';
import { last } from 'lodash';
import { FirebaseApp } from '../../../src/app/app';
import { Firestore } from '../../../src/firestore/firestore';
import { IDocument } from '../../../src/firestore/interfaces';

export const totalGuardiansRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);
  let lastDocId = '';

  do {
    const startAfter = await getSnapshot(db, COL.SPACE, lastDocId);
    const spaces = await db.collection(COL.SPACE).startAfter(startAfter).limit(500).get<Space>();
    lastDocId = last(spaces)?.uid || '';

    const promises = spaces.map(async (space) => {
      const totalGuardians = await getMemberCount(db, space.uid, SUB_COL.GUARDIANS);
      const totalMembers = await getMemberCount(db, space.uid, SUB_COL.MEMBERS);
      const totalPendingMembers = await getMemberCount(db, space.uid, SUB_COL.KNOCKING_MEMBERS);
      return { uid: space.uid, totalGuardians, totalMembers, totalPendingMembers };
    });
    const spaceCounts = await Promise.all(promises);

    const batch = db.batch();
    spaceCounts.forEach((data) => {
      const spaceDocRef = db.doc(`${COL.SPACE}/${data.uid}`);
      batch.update(spaceDocRef, data);
    });
    await batch.commit();
  } while (lastDocId);
};

export const roll = totalGuardiansRoll;

const getMemberCount = (db: Firestore, space: string, subCol: SUB_COL) =>
  db.collection(COL.SPACE).doc(space).collection(subCol).count();

const getSnapshot = (
  db: Firestore,
  col: COL | PublicCollections,
  id?: string,
  subCol?: SUB_COL | PublicSubCollections,
  childId?: string,
) => {
  if (!id) {
    return;
  }
  let doc: IDocument = db.doc(`${col}/${id}`);
  if (subCol && childId) {
    doc = doc.collection(subCol).doc(childId);
  }
  return doc.getSnapshot();
};
