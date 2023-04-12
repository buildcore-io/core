/* eslint-disable @typescript-eslint/no-explicit-any */
import { ALGOLIA_COLLECTIONS, COL } from '@soonaverse/interfaces';
import algoliasearch from 'algoliasearch';
import { last } from 'lodash';
import { docToAlgoliaData } from '../../../src/algolia/firestore.to.algolia';
import { FirebaseApp } from '../../../src/firebase/app/app';
import { Firestore } from '../../../src/firebase/firestore/firestore';
import { algoliaAppId, algoliaKey } from '../../../src/utils/config.utils';

const client = algoliasearch(algoliaAppId(), algoliaKey());

export const algoliaRoll = async (app: FirebaseApp, col: COL) => {
  const db = new Firestore(app);
  let lastDocId = '';

  do {
    const lastDoc = lastDocId ? await db.doc(`${col}/${lastDocId}`).getSnapshot() : undefined;
    const snap = await db
      .collection(col)
      .startAfter(lastDoc)
      .limit(500)
      .get<Record<string, unknown>>();
    lastDocId = (last(snap)?.uid || '') as string;

    const promises = snap.map((docData) => upsertObject(docData, col, docData.uid as string));
    await Promise.all(promises);
  } while (lastDocId);
};

const upsertObject = async (docData: Record<string, unknown>, col: COL, objectID: string) => {
  const data = docToAlgoliaData({ ...docData, objectID, id: objectID });
  try {
    await client.initIndex(col).saveObject(data).wait();
  } catch (error) {
    console.log(col, objectID, error);
  }
};

export const roll = async (app: FirebaseApp) => {
  const promises = ALGOLIA_COLLECTIONS.map((col) => algoliaRoll(app, col));
  await Promise.all(promises);
};
