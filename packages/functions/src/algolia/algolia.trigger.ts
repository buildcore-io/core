import { ALGOLIA_COLLECTIONS } from '@soonaverse/interfaces';
import algoliasearch from 'algoliasearch';
import * as functions from 'firebase-functions';
import { scaleAlgolia } from '../scale.settings';
import { algoliaAppId, algoliaKey, isEmulatorEnv } from '../utils/config.utils';
import { docToAlgoliaData } from './firestore.to.algolia';

const client = algoliasearch(algoliaAppId(), algoliaKey());

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
      const objectID = change.after.data()?.uid || '';
      const data = docToAlgoliaData({ ...change.after.data(), objectID, id: objectID });
      try {
        await client.initIndex(col).saveObject(data).wait();
      } catch (error) {
        functions.logger.error(col, objectID, error);
      }
    }),
})).reduce((acc, act) => ({ ...acc, ...act }), {});
