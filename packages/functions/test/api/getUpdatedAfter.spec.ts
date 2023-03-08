import { PublicCollections, QUERY_MAX_LENGTH } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty, last } from 'lodash';
import admin from '../../src/admin.config';
import { getUpdatedAfter } from '../../src/api/getUpdatedAfter';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Get many by id', () => {
  let uids = [] as string[];
  let updatedOn: dayjs.Dayjs;

  beforeEach(async () => {
    const count = QUERY_MAX_LENGTH + 1;
    updatedOn = dayjs().add(100, 'y');
    uids = Array.from(Array(count)).map(() => getRandomEthAddress());
  });

  const createMany = async (col: PublicCollections, customData: any = {}) => {
    const batch = admin.firestore().batch();
    uids.forEach((uid, i) => {
      const docRef = admin.firestore().doc(`${col}/${uid}`);
      batch.create(docRef, { uid, updatedOn: dateToTimestamp(updatedOn), ...customData });
    });
    await batch.commit();
  };

  const sendRequest = async (collection: PublicCollections, startAfter?: string) => {
    const response: any[] = [];
    const req = {
      query: {
        collection,
        updatedAfter: updatedOn.valueOf(),
        startAfter,
      },
    } as any;
    const res = {
      send: (body: any[]) => {
        response.push(...body);
      },
    } as any;
    await getUpdatedAfter(req, res);

    return response;
  };

  it('Should get all members', async () => {
    const collection = PublicCollections.MEMBER;
    await createMany(collection);

    const batch1 = await sendRequest(collection);
    expect(batch1.length).toBe(100);

    const batch2 = await sendRequest(collection, last(batch1)?.uid);
    expect(batch2.length).toBe(1);

    expect(uids.sort()).toEqual([...batch1, ...batch2].map((b) => b.uid).sort());
  });

  it('Should get all nfts', async () => {
    const collection = PublicCollections.NFT;
    await createMany(collection, { hidden: false });
    admin
      .firestore()
      .doc(`${collection}/${getRandomEthAddress()}`)
      .create({ updatedOn: dateToTimestamp(updatedOn), hidden: true });

    const batch1 = await sendRequest(collection);
    expect(batch1.length).toBe(100);

    const batch2 = await sendRequest(collection, last(batch1)?.uid);
    expect(batch2.length).toBe(1);

    expect(uids.sort()).toEqual([...batch1, ...batch2].map((b) => b.uid).sort());
  });

  it('Should get all transactions', async () => {
    const collection = PublicCollections.TRANSACTION;
    const custom = { isOrderType: false, ignoreWallet: true, payload: {} };
    await createMany(collection, custom);
    admin
      .firestore()
      .doc(`${collection}/${getRandomEthAddress()}`)
      .create({ updatedOn: dateToTimestamp(updatedOn), ...custom, isOrderType: true });

    const batch1 = await sendRequest(collection);
    expect(batch1.length).toBe(100);

    const batch2 = await sendRequest(collection, last(batch1)?.uid);
    expect(batch2.length).toBe(1);

    expect(uids.sort()).toEqual([...batch1, ...batch2].map((b) => b.uid).sort());
  });

  it('Should get updatedAfter not provided', async () => {
    const collection = PublicCollections.MEMBER;
    await createMany(collection);
    const req = { query: { collection, uid: uids[0] } } as any;
    const res = {
      send: (body: any[]) => {
        const allHaveIds = body.reduce((acc: any, act: any) => acc && !isEmpty(act.id), true);
        expect(allHaveIds).toBe(true);
        expect(body.length).toBe(100);
      },
    } as any;
    await getUpdatedAfter(req, res);
  });
});
