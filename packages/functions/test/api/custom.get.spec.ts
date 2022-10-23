import { COL, PublicCollections, TransactionType, WenError } from '@soon/interfaces';
import admin from '../../src/admin.config';
import { getById } from '../../src/api/getById';
import { getMany } from '../../src/api/getMany';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { expectThrow } from '../controls/common';

describe('Test custom constraints', () => {
  let uids = [] as string[];
  let space = '';

  beforeEach(() => {
    uids = Array.from(Array(5)).map(() => getRandomEthAddress());
    space = getRandomEthAddress();
  });

  it.each([PublicCollections.AVATARS, PublicCollections.BADGES])(
    'Get all should only return one for collection',
    async (collection: PublicCollections) => {
      const batch = admin.firestore().batch();
      uids.forEach((uid) =>
        batch.create(admin.firestore().doc(`${collection}/${uid}`), { name: uid }),
      );
      await batch.commit();
      const req = { body: { collection } } as any;
      const res = {
        send: (body: any) => {
          expect(body.length).toBe(1);
        },
      } as any;
      await getMany(req, res);
    },
  );

  it('Get all should only return none hidden nfts', async () => {
    uids = Array.from(Array(5)).map(() => getRandomEthAddress());
    const batch = admin.firestore().batch();
    uids.forEach((uid, i) =>
      batch.create(admin.firestore().doc(`${PublicCollections.NFT}/${uid}`), {
        name: uid,
        space,
        hidden: i > 1,
      }),
    );
    await batch.commit();
    const req = {
      body: { collection: PublicCollections.NFT, fieldName: 'space', fieldValue: space },
    } as any;
    const res = {
      send: (body: any) => {
        expect(body.length).toBe(2);
      },
    } as any;
    await getMany(req, res);
  });

  it('Get many by id should only return none hidden nfts', async () => {
    uids = Array.from(Array(5)).map(() => getRandomEthAddress());
    const batch = admin.firestore().batch();
    uids.forEach((uid, i) =>
      batch.create(admin.firestore().doc(`${PublicCollections.NFT}/${uid}`), {
        name: uid,
        space,
        hidden: i > 1,
      }),
    );
    await batch.commit();
    const req = { body: { collection: PublicCollections.NFT, uids } } as any;
    const res = {
      send: (body: any) => {
        expect(body.length).toBe(2);
      },
    } as any;
    await getById(req, res);
  });

  it('Get all should not return order transactions', async () => {
    uids = Array.from(Array(5)).map(() => getRandomEthAddress());
    const batch = admin.firestore().batch();
    uids.forEach((uid, i) =>
      batch.create(admin.firestore().doc(`${PublicCollections.TRANSACTION}/${uid}`), {
        name: uid,
        space,
        type: i <= 1 ? TransactionType.BILL_PAYMENT : TransactionType.ORDER,
      }),
    );
    await batch.commit();
    const req = {
      body: { collection: PublicCollections.TRANSACTION, fieldName: 'space', fieldValue: space },
    } as any;
    const res = {
      send: (body: any) => {
        expect(body.length).toBe(2);
      },
    } as any;
    await getMany(req, res);
  });

  it.each([COL.MNEMONIC, COL.SYSTEM])(
    'Should not access restricted collections',
    async (collection: COL) => {
      const uid = getRandomEthAddress();
      await admin.firestore().doc(`${collection}/${uid}`).create({ name: 'asd' });
      const req = { body: { collection, uids: [uid] } } as any;
      const res = {} as any;
      await expectThrow(getById(req, res), WenError.invalid_params.key);
    },
  );
});
