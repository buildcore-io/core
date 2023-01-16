import { ALGOLIA_COLLECTIONS, COL } from '@soonaverse/interfaces';
import algoliasearch from 'algoliasearch';
import { algoliaTrigger } from '../../src/index';
import * as config from '../../src/utils/config.utils';
import { algoliaAppId, algoliaKey } from '../../src/utils/config.utils';
import { getRandomSymbol, wait } from '../controls/common';
import { testEnv } from '../set-up';

let isEmulatorSpy: jest.SpyInstance<boolean, []>;

const client = algoliasearch(algoliaAppId(), algoliaKey());

describe('Algolia trigger', () => {
  beforeEach(() => {
    isEmulatorSpy = jest.spyOn(config, 'isEmulatorEnv');
    isEmulatorSpy.mockReturnValue(false);
  });

  it.each(ALGOLIA_COLLECTIONS)('Should update algolia index', async (col: COL) => {
    const data = { uid: `${col}_doc_id`, symbol: getRandomSymbol() };
    const docPath = `${col}/${data.uid}`;

    const beforeSnap = testEnv.firestore.makeDocumentSnapshot(data, docPath);
    const afterSnap = testEnv.firestore.makeDocumentSnapshot(data, docPath);
    const change = testEnv.makeChange(beforeSnap, afterSnap);
    const wrapped = testEnv.wrap(algoliaTrigger[col]);
    await wrapped(change);

    await wait(async () => {
      const { hits } = await client.initIndex(col).search(data.symbol);
      return hits.length > 0;
    });

    isEmulatorSpy.mockRestore();
  });
});
