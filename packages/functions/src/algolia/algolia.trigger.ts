import { ALGOLIA_COLLECTIONS, WEN_FUNC } from '@soonaverse/interfaces';
import algoliasearch from 'algoliasearch';
import * as functions from 'firebase-functions';
import { RuntimeOptions } from 'firebase-functions';
import { scale } from '../scale.settings';
import { algoliaAppId, algoliaKey, isEmulatorEnv } from '../utils/config.utils';

const client = algoliasearch(algoliaAppId(), algoliaKey());

const RUN_WITH: RuntimeOptions = {
  minInstances: scale(WEN_FUNC.algolia),
};

export const algoliaTrigger = ALGOLIA_COLLECTIONS.map((col) => ({
  [col]: functions
    .runWith(RUN_WITH)
    .firestore.document(col + '/{documentId}')
    .onWrite(async (change) => {
      if (isEmulatorEnv()) {
        return;
      }
      const objectID = change.after.data()?.uid || '';
      const data = { ...change.after.data(), objectID, id: objectID };
      try {
        await client.initIndex(col).saveObject(data).wait();
      } catch (error) {
        functions.logger.error(col, objectID, error);
      }
    }),
})).reduce((acc, act) => ({ ...acc, ...act }), {});
