import { ALGOLIA_COLLECTIONS, COL } from '@soonaverse/interfaces';
import algoliasearch from 'algoliasearch';
import dayjs from 'dayjs';
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
    const now = dayjs();
    const data = {
      uid: `${col}_doc_id`,
      symbol: getRandomSymbol(),
      age: 12,
      createdOn: now.toDate(),
      settings: {
        expiresOn: now.toDate(),
        options: ['on', 'off'],
      },
      bookings: [
        {
          date: now.toDate(),
          name: {
            first: 'first',
            last: 'last',
          },
        },
      ],
    };
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

    const { hits } = await client.initIndex(col).search(data.symbol);
    const hit = hits[0] as any;
    expect(hit.uid).toBe(data.uid);
    expect(hit.symbol).toBe(data.symbol);
    expect(hit.age).toBe(data.age);
    expect(hit.createdOn).toBe(now.toDate().getTime());
    expect(hit.settings.expiresOn).toBe(now.toDate().getTime());
    expect(hit.settings.options).toEqual(data.settings.options);
    expect(hit.bookings[0].date).toBe(now.toDate().getTime());
    expect(hit.bookings[0].name).toEqual(data.bookings[0].name);

    isEmulatorSpy.mockRestore();
  });
});
