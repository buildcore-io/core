import { COL, Opr, PublicCollections, TransactionType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { getManyAdvanced } from '../../src/api/getManyAdvanced';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Get many advanced', () => {
  it('Should get last 3', async () => {
    const count = 5;
    const name = getRandomEthAddress();
    const members = Array.from(Array(count)).map((_, i) => ({
      uid: getRandomEthAddress(),
      name,
      date: dayjs().add(i, 'd').toDate(),
    }));
    for (const member of members) {
      await soonDb().doc(`${COL.MEMBER}/${member.uid}`).create(member);
    }

    let req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: ['name', 'date'],
        fieldValue: [name, dayjs().add(30, 'h').toISOString()],
        operator: ['==', '>='],
      },
    } as any;
    let res = {
      send: (body: any) => {
        expect(body.length).toBe(3);
      },
    } as any;
    await getManyAdvanced(req, res);

    req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: ['name', 'date'],
        fieldValue: [name, dayjs().add(30, 'h').toISOString()],
        operator: ['==', '>='],

        orderBy: ['date'],
        orderByDir: ['desc'],
      },
    } as any;
    res = {
      send: (body: any) => {
        expect(body.length).toBe(3);
        for (let i = 1; i < body.length; ++i) {
          expect(body[i - 1].date._seconds).toBeGreaterThan(body[i].date._seconds);
        }
      },
    } as any;
    await getManyAdvanced(req, res);

    req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: ['name', 'date'],
        fieldValue: [name, dayjs().add(30, 'h').toISOString()],
        operator: ['==', '>='],

        orderBy: ['date'],
        orderByDir: ['asc'],
      },
    } as any;
    res = {
      send: (body: any) => {
        expect(body.length).toBe(3);
        for (let i = 1; i < body.length; ++i) {
          expect(body[i - 1].date._seconds).toBeLessThan(body[i].date._seconds);
        }
      },
    } as any;
    await getManyAdvanced(req, res);
  });

  it('Should filter orders', async () => {
    const space = getRandomEthAddress();
    const transactions = [
      { uid: getRandomEthAddress(), type: TransactionType.ORDER, space, isOrderType: true },
      { uid: getRandomEthAddress(), type: TransactionType.AWARD, space, isOrderType: false },
    ];
    for (const transaction of transactions) {
      await soonDb().doc(`${COL.TRANSACTION}/${transaction.uid}`).create(transaction);
    }
    const req = {
      query: {
        collection: PublicCollections.TRANSACTION,
        fieldName: ['space'],
        fieldValue: [space],
        operator: [Opr.EQUAL],
      },
    } as any;
    const res = {
      send: (body: any) => {
        expect(body.length).toBe(1);
        expect(body[0].type).toBe(TransactionType.AWARD);
      },
    } as any;
    await getManyAdvanced(req, res);
  });

  it('Should filter nft', async () => {
    const space = getRandomEthAddress();
    const nfts = [
      { uid: getRandomEthAddress(), hidden: true, space },
      { uid: getRandomEthAddress(), hidden: false, space },
    ];
    for (const nft of nfts) {
      await soonDb().doc(`${COL.NFT}/${nft.uid}`).create(nft);
    }
    let req = {
      query: {
        collection: PublicCollections.NFT,
        fieldName: ['space'],
        fieldValue: [space],
        operator: [Opr.EQUAL],
      },
    } as any;
    let res = {
      send: (body: any) => {
        expect(body.length).toBe(1);
      },
    } as any;
    await getManyAdvanced(req, res);

    req = {
      query: {
        collection: PublicCollections.NFT,
        fieldName: ['space', 'hidden'],
        fieldValue: [space, true],
        operator: [Opr.EQUAL, Opr.EQUAL],
      },
    } as any;
    res = {
      send: (body: any) => {
        expect(body.length).toBe(0);
      },
    } as any;
    await getManyAdvanced(req, res);
  });
});
