import { COL, Network } from '@build5/interfaces';
import dayjs from 'dayjs';
import { last } from 'lodash';
import { getAddresses } from '../../src/api/getAddresses';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { projectId, testEnv } from '../set-up';

describe('Get all', () => {
  beforeEach(async () => {
    await testEnv.config.firestore.clearFirestoreData(projectId);
  });

  it('Get all paginated', async () => {
    const count = 1010;
    const now = dayjs();
    const addresses = Array.from(Array(count)).map(() => getRandomEthAddress());

    let batch = soonDb().batch();
    for (let i = 0; i < count; i++) {
      const docRef = soonDb().doc(`${COL.MNEMONIC}/${addresses[i]}`);
      batch.create(docRef, { createdOn: dateToTimestamp(now.add(i, 'd')), network: Network.RMS });
      if (i % 499 === 0) {
        await batch.commit();
        batch = soonDb().batch();
      }
    }
    await batch.commit();

    const response: any[] = [];
    let createdAfter = dayjs().subtract(1, 'd').valueOf();
    let req = { query: { network: Network.RMS, createdAfter } } as any;
    let res = {
      send: (body: any[]) => {
        response.push(...body);
        expect(body.length).toBe(1000);
      },
    } as any;
    await getAddresses(req, res);

    createdAfter = dayjs(last(response).createdOn).valueOf();
    req = {
      query: {
        network: Network.RMS,
        createdAfter,
      },
    } as any;
    res = {
      send: (body: any) => {
        response.push(...body);
        expect(body.length).toBe(10);
      },
    } as any;
    await getAddresses(req, res);

    for (let i = 0; i < count; i++) {
      expect(response[i].createdOn).toEqual(now.add(i, 'd').toDate());
      expect(addresses.includes(response[i].addressBech32)).toBe(true);
      expect(Object.keys(response[i]).sort()).toEqual(['addressBech32', 'createdOn']);
    }
  });

  it('Get all for selected network', async () => {
    const count = 10;
    const now = dayjs();
    const addresses = Array.from(Array(count)).map(() => getRandomEthAddress());

    for (let i = 0; i < count; i++) {
      const docRef = soonDb().doc(`${COL.MNEMONIC}/${addresses[i]}`);
      await docRef.create({
        createdOn: dateToTimestamp(now),
        network: i > 5 ? Network.IOTA : Network.RMS,
      });
    }

    let createdAfter = dayjs().subtract(1, 'd').valueOf();
    let req = { query: { network: Network.RMS, createdAfter } } as any;
    let res = {
      send: (body: any[]) => {
        expect(body.length).toBe(6);
      },
    } as any;
    await getAddresses(req, res);

    createdAfter = dayjs().subtract(1, 'd').valueOf();
    req = { query: { network: Network.IOTA, createdAfter } } as any;
    res = {
      send: (body: any[]) => {
        expect(body.length).toBe(4);
      },
    } as any;
    await getAddresses(req, res);
  });
});
