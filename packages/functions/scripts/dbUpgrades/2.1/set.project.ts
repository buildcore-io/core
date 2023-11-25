import { FirebaseApp } from '@build-5/database';
import { COL, SOON_PROJECT_ID } from '@build-5/interfaces';
import admin from 'firebase-admin';
import { last } from 'lodash';

const collections = [COL.NFT_STAKE, COL.COLLECTION, COL.NFT, COL.SPACE, COL.TRANSACTION];

type DocType = admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData> | undefined;
type QuerySnap = admin.firestore.QuerySnapshot<admin.firestore.DocumentData>;

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
        batch.update(d.ref, { project: SOON_PROJECT_ID });
      });

      await batch.commit();
    } while (lastDoc);
  }
};

export const roll = setProjectRoll;
