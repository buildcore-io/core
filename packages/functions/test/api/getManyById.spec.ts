import { PublicCollections, PublicSubCollections, WenError } from '@soon/interfaces';
import admin from '../../src/admin.config';
import { getById } from '../../src/api/getById';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { expectThrow } from '../../test/controls/common';

describe('Get many by id', () => {
  it('Should get many', async () => {
    const uid1 = getRandomEthAddress();
    const uid2 = getRandomEthAddress();
    await admin
      .firestore()
      .doc(`${PublicCollections.MEMBER}/${uid1}`)
      .create({ name: 'asd', uid: uid1 });
    await admin
      .firestore()
      .doc(`${PublicCollections.MEMBER}/${uid2}`)
      .create({ name: 'ccc', uid: uid2 });
    const req = { body: { collection: PublicCollections.MEMBER, uids: [uid1, uid2] } } as any;
    const res = {
      send: (body: any) => {
        expect(body.length).toBe(2);
        expect(body[0].name).toBe('asd');
        expect(body[1].name).toBe('ccc');
      },
    } as any;
    await getById(req, res);
  });

  it('Should return only one', async () => {
    const uid = getRandomEthAddress();
    await admin.firestore().doc(`${PublicCollections.MEMBER}/${uid}`).create({ name: 'asd', uid });
    const req = {
      body: { collection: PublicCollections.MEMBER, uids: [uid, getRandomEthAddress()] },
    } as any;
    const res = {
      send: (body: any) => {
        expect(body.length).toBe(1);
        expect(body[0].name).toBe('asd');
      },
    } as any;
    await getById(req, res);
  });

  it('Should throw, uids lenth too much', async () => {
    const req = {
      body: {
        collection: PublicCollections.MEMBER,
        uids: Array.from(Array(101)).map(() => getRandomEthAddress()),
      },
    } as any;
    const res = {} as any;
    await expectThrow(getById(req, res), WenError.invalid_params.key);
  });

  it('Should throw, uids not unique', async () => {
    const uid = getRandomEthAddress();
    const req = {
      body: {
        collection: PublicCollections.MEMBER,
        uids: [uid, uid],
      },
    } as any;
    const res = {} as any;
    await expectThrow(getById(req, res), WenError.invalid_params.key);
  });
});

describe('Get many sub by id', () => {
  it('Should get many sub', async () => {
    const parentId = getRandomEthAddress();
    const child1 = getRandomEthAddress();
    const child2 = getRandomEthAddress();

    await admin
      .firestore()
      .doc(`${PublicCollections.SPACE}/${parentId}/${PublicSubCollections.MEMBERS}/${child1}`)
      .create({ name: 'asd' });
    await admin
      .firestore()
      .doc(`${PublicCollections.SPACE}/${parentId}/${PublicSubCollections.MEMBERS}/${child2}`)
      .create({ name: 'ccc' });
    const req = {
      body: {
        collection: PublicCollections.SPACE,
        parentUid: parentId,
        subCollection: PublicSubCollections.MEMBERS,
        uids: [child1, child2],
      },
    } as any;
    const res = {
      send: (body: any) => {
        expect(body.length).toBe(2);
        expect(body[0].name).toBe('asd');
        expect(body[1].name).toBe('ccc');
      },
    } as any;
    await getById(req, res);
  });
});
