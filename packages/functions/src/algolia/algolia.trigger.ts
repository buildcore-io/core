import { ALGOLIA_COLLECTIONS, COL } from '@soonaverse/interfaces';
import algoliasearch from 'algoliasearch';
import * as functions from 'firebase-functions';
import { scaleAlgolia } from '../scale.settings';
import { algoliaAppId, algoliaKey, isEmulatorEnv } from '../utils/config.utils';
import { docToAlgoliaData } from './firestore.to.algolia';

const client = algoliasearch(algoliaAppId(), algoliaKey());

const deleteObject = async (col: COL, objectID: string) => {
  try {
    await client.initIndex(col).deleteObject(objectID);
  } catch (error) {
    functions.logger.error(col, objectID, error);
  }
};

const upsertObject = async (
  doc: functions.firestore.DocumentSnapshot,
  col: COL,
  objectID: string,
) => {
  const data = docToAlgoliaData({ ...doc.data(), objectID, id: objectID });
  try {
    await client.initIndex(col).saveObject(data).wait();
  } catch (error) {
    functions.logger.error(col, objectID, error);
  }
};

export const algoliaTrigger = ALGOLIA_COLLECTIONS.map((col) => ({
  [col]: functions
    .runWith({
      minInstances: scaleAlgolia(col),
    })
    .firestore.document(col + '/{documentId}')
    .onWrite(async (change) => {
      if (isEmulatorEnv()) {
        return;
      }
      const prev = change.before.data();
      const curr = change.after.data();
      const objectID = curr?.uid || prev?.uid || '';

      if (!objectID) {
        return;
      }

      if (!curr) {
        return await deleteObject(col, objectID);
      }

      return await upsertObject(change.after, col, objectID);
    }),
})).reduce((acc, act) => ({ ...acc, ...act }), {});
