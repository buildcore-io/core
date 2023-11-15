import { FirebaseApp, Firestore, build5Db } from '@build-5/database';
import { ALGOLIA_COLLECTIONS, BaseRecord, COL } from '@build-5/interfaces';
import algoliasearch, { SearchClient } from 'algoliasearch';
import { last } from 'lodash';
import { docToAlgoliaData } from '../../../src/triggers/algolia/firestore.to.algolia';
import { algoliaAppId, algoliaKey } from '../../../src/utils/config.utils';

export const algoliaRoll = async (app: FirebaseApp) => {
  const client = algoliasearch(algoliaAppId(), algoliaKey());
  const db = new Firestore(app);

  for (const col of ALGOLIA_COLLECTIONS) {
    let lastDocId = '';
    do {
      console.log('Refreshing', col, lastDocId);

      const lastDoc = lastDocId
        ? await build5Db().doc(`${col}/${lastDocId}`).getSnapshot()
        : undefined;

      const snap = await db.collection(col).limit(500).startAfter(lastDoc).get<BaseRecord>();

      lastDocId = last(snap)?.uid || '';

      const promises = snap.map((s) => upsertObject(client, s, col, s.uid));
      await Promise.all(promises);
    } while (lastDocId);
  }
};

const upsertObject = async (
  client: SearchClient,
  rawData: BaseRecord,
  col: COL,
  objectID: string,
) => {
  const data = docToAlgoliaData({ ...rawData, objectID, id: objectID });
  try {
    await client.initIndex(col).saveObject(data).wait();
  } catch (error) {
    console.error(col, objectID, error);
  }
};

export const roll = algoliaRoll;
