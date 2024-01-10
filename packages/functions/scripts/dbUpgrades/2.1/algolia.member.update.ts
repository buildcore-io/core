import { FirebaseApp } from '@build-5/database';
import { COL } from '@build-5/interfaces';
import algoliasearch from 'algoliasearch';
import admin from 'firebase-admin';
import { last } from 'lodash';
import { docToAlgoliaData } from '../../../src/triggers/algolia/firestore.to.algolia';

export const algoliaMemberUpdate = async (app: FirebaseApp) => {
  const instance = app.getInstance() as admin.app.App;
  const firestore = instance.firestore();

  const client = algoliasearch(process.env.ALGOLIA_APPID!, process.env.ALGOLIA_KEY!);
  const index = client.initIndex(COL.MEMBER);

  let lastDoc: any = undefined;
  do {
    let query = firestore.collection(COL.MEMBER).limit(2000);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const objects = snap.docs.map((doc) => {
      const objectID = doc.id;
      return docToAlgoliaData({ ...doc.data(), objectID, id: objectID });
    });

    await index.saveObjects(objects).wait();
  } while (lastDoc !== undefined);
};

export const roll = algoliaMemberUpdate;
