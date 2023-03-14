import { ALGOLIA_COLLECTIONS, COL, UnsoldMintingOptions } from '@soonaverse/interfaces';
import algoliasearch from 'algoliasearch';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { algoliaRoll } from '../../src/firebase/dbRoll/algolia.roll';
import { algoliaTrigger } from '../../src/index';
import * as config from '../../src/utils/config.utils';
import { algoliaAppId, algoliaKey } from '../../src/utils/config.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
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

  it.each(ALGOLIA_COLLECTIONS)('Should delete algolia index', async (col: COL) => {
    const data = {
      uid: `${col}_doc_id`,
      symbol: getRandomSymbol(),
    };
    const docPath = `${col}/${data.uid}`;

    let beforeSnap = testEnv.firestore.makeDocumentSnapshot(data, docPath);
    let afterSnap = testEnv.firestore.makeDocumentSnapshot(data, docPath);

    let change = testEnv.makeChange(beforeSnap, afterSnap);
    let wrapped = testEnv.wrap(algoliaTrigger[col]);
    await wrapped(change);

    await wait(async () => {
      const { hits } = await client.initIndex(col).search(data.symbol);
      return hits.length > 0;
    });

    beforeSnap = testEnv.firestore.makeDocumentSnapshot(data, docPath);
    afterSnap = testEnv.firestore.makeDocumentSnapshot({}, docPath);

    change = testEnv.makeChange(beforeSnap, afterSnap);
    wrapped = testEnv.wrap(algoliaTrigger[col]);
    await wrapped(change);

    await wait(async () => {
      const { hits } = await client.initIndex(col).search(data.symbol);
      return hits.length === 0;
    });
  });

  it('Should roll algolia', async () => {
    const collectionId = getRandomEthAddress();
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collectionId}`);
    await collectionDocRef.create({
      uid: collectionId,
      mintingData: { unsoldMintingOptions: UnsoldMintingOptions.BURN_UNSOLD },
    });

    const nfts = Array.from(Array(2))
      .map(() => getRandomEthAddress())
      .map((uid) => ({ collection: collectionId, uid, objectID: uid }));

    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nfts[0].uid}`);
    await nftDocRef.create(nfts[0]);

    for (const nft of nfts) {
      await client.initIndex(COL.NFT).saveObject(nft).wait();
    }
    const req = {} as any;
    const res = { sendStatus: () => {} } as any;
    await algoliaRoll(req, res);

    await wait(async () => {
      const { hits } = await client.initIndex(COL.NFT).search(collectionId);
      return hits.length === 1;
    });
  });
});
