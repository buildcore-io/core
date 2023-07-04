import { PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { getById } from '../../src/api/getById';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Get by id test', () => {
  it('Should get by id', async () => {
    const uid = getRandomEthAddress();
    await build5Db().doc(`${PublicCollections.MEMBER}/${uid}`).create({ name: 'asd', uid });
    const req = { query: { collection: PublicCollections.MEMBER, uid: uid } } as any;
    const res = {
      send: (body: any) => {
        expect(body.id).toBe(body.uid);
        expect(body.name).toBe('asd');
      },
    } as any;
    await getById(req, res);
  });

  it('Should send nothing', async () => {
    const req = {
      query: { collection: PublicCollections.MEMBER, uid: getRandomEthAddress() },
    } as any;
    const res = {
      status: (code: any) => {
        expect(code).toBe(404);
      },
      send: (body: any) => {
        expect(body).toEqual({});
      },
    } as any;
    await getById(req, res);
  });

  it('Should throw, invalid collection', async () => {
    const req = { query: { collection: 'asd', uid: getRandomEthAddress() } } as any;
    const res = {
      status: (code: any) => {
        expect(code).toBe(400);
      },
      send: () => {},
    } as any;
    await getById(req, res);
  });

  it('Should get sub doc', async () => {
    const uid = getRandomEthAddress();
    const childUid = getRandomEthAddress();

    await build5Db()
      .doc(`${PublicCollections.SPACE}/${uid}/${PublicSubCollections.MEMBERS}/${childUid}`)
      .create({ name: 'asd' });
    const req = {
      query: {
        collection: PublicCollections.SPACE,
        parentUid: uid,
        subCollection: PublicSubCollections.MEMBERS,
        uid: childUid,
      },
    } as any;
    const res = {
      send: (body: any) => {
        expect(body.name).toBe('asd');
      },
    } as any;
    await getById(req, res);
  });
});
