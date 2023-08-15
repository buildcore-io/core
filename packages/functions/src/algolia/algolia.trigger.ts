import { ALGOLIA_COLLECTIONS, COL } from '@build-5/interfaces';
import algoliasearch from 'algoliasearch';
import * as functions from 'firebase-functions/v2';
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

const upsertObject = async (rawData: Record<string, unknown>, col: COL, objectID: string) => {
  const data = docToAlgoliaData({ ...rawData, objectID, id: objectID });
  try {
    await client.initIndex(col).saveObject(data).wait();
  } catch (error) {
    functions.logger.error(col, objectID, error);
  }
};

export const algoliaTrigger = ALGOLIA_COLLECTIONS.map((col) => ({
  [col]: functions.firestore.onDocumentWritten(
    { document: col + '/{documentId}', ...scaleAlgolia(col) },
    async (event) => {
      if (isEmulatorEnv()) {
        return;
      }
      const prev = event.data?.before?.data();
      const curr = event.data?.after?.data();
      const objectID = curr?.uid || prev?.uid || '';

      if (!objectID) {
        return;
      }

      if (!curr) {
        return await deleteObject(col, objectID);
      }

      return await upsertObject(curr, col, objectID);
    },
  ),
})).reduce((acc, act) => ({ ...acc, ...act }), {});
