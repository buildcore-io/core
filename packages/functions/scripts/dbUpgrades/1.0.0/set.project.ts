import { FirebaseApp } from '@build-5/database';
import { BaseRecord, COL, SOON_PROJECT_ID, SUB_COL } from '@build-5/interfaces';
import admin from 'firebase-admin';
import { last } from 'lodash';

const collections = [
  COL.AWARD,
  COL.COLLECTION,
  COL.NFT,
  COL.SPACE,
  COL.PROPOSAL,
  COL.TRANSACTION,
  COL.BADGES,
  COL.TOKEN,
  COL.TOKEN_MARKET,
  COL.TOKEN_PURCHASE,
  COL.STAKE,
  COL.STAKE_REWARD,
  COL.NFT_STAKE,
  COL.AIRDROP,
];

const subCollections = [
  SUB_COL.OWNERS,
  SUB_COL.PARTICIPANTS,
  SUB_COL.MEMBERS,
  SUB_COL.GUARDIANS,
  SUB_COL.ADMINS,
  SUB_COL.BLOCKED_MEMBERS,
  SUB_COL.KNOCKING_MEMBERS,
  SUB_COL.DISTRIBUTION,
  SUB_COL.STATS,
  SUB_COL.VOTES,
  SUB_COL.RANKS,
];

type DocType = admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData> | undefined;
type QuerySnap = admin.firestore.QuerySnapshot<admin.firestore.DocumentData>;

const dataToSet = { project: SOON_PROJECT_ID, projects: { [SOON_PROJECT_ID]: true } };

export const setProjectRoll = async (app: FirebaseApp) => {
  const adminApp = app.getInstance() as admin.app.App;
  const db = adminApp.firestore();

  for (const col of collections) {
    let lastDoc: DocType = undefined;

    do {
      const batch = db.batch();
      let query = db.collection(col).limit(500);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      const snap: QuerySnap = await query.get();
      lastDoc = last(snap.docs);

      snap.docs.forEach((d) => {
        const data = d.data() as BaseRecord;
        if (!data.project) {
          batch.update(d.ref, dataToSet);
        }
      });

      await batch.commit();
    } while (lastDoc);
  }

  for (const subCol of subCollections) {
    let lastDoc: DocType = undefined;

    do {
      const batch = db.batch();
      let query = db.collectionGroup(subCol).limit(500);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      const snap: QuerySnap = await query.get();
      lastDoc = last(snap.docs);

      snap.docs.forEach((d) => {
        const data = d.data() as BaseRecord;
        if (!data.project) {
          batch.update(d.ref, dataToSet);
        }
      });

      await batch.commit();
    } while (lastDoc);
  }
};

export const roll = setProjectRoll;
