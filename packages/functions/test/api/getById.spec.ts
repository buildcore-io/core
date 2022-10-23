import { PublicCollections, PublicSubCollections, WenError } from '@soon/interfaces';
import admin from '../../src/admin.config';
import { getById } from '../../src/api/getById';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { expectThrow } from '../controls/common';

describe('Get by id test', () => {
  it('Should get by id', async () => {
    const uid = getRandomEthAddress();
    await admin.firestore().doc(`${PublicCollections.MEMBER}/${uid}`).create({ name: 'asd', uid });
    const req = { body: { collection: PublicCollections.MEMBER, uids: [uid] } } as any;
    const res = {
      send: (body: any) => {
        expect(body[0].name).toBe('asd');
      },
    } as any;
    await getById(req, res);
  });

  it('Should send nothing', async () => {
    const req = {
      body: { collection: PublicCollections.MEMBER, uids: [getRandomEthAddress()] },
    } as any;
    const res = {
      send: (body: any[]) => {
        expect(body.length).toBe(0);
      },
    } as any;
    await getById(req, res);
  });

  it('Should throw, invalid collection', async () => {
    const req = { body: { collection: 'asd', uids: [getRandomEthAddress()] } } as any;
    const res = {} as any;
    await expectThrow(getById(req, res), WenError.invalid_params.key);
  });

  it('Should get sub doc', async () => {
    const uid = getRandomEthAddress();
    const childUid = getRandomEthAddress();

    await admin
      .firestore()
      .doc(`${PublicCollections.SPACE}/${uid}/${PublicSubCollections.MEMBERS}/${childUid}`)
      .create({ name: 'asd' });
    const req = {
      body: {
        collection: PublicCollections.SPACE,
        parentUid: uid,
        subCollection: PublicSubCollections.MEMBERS,
        uids: [childUid],
      },
    } as any;
    const res = {
      send: (body: any) => {
        expect(body[0].name).toBe('asd');
      },
    } as any;
    await getById(req, res);
  });
});
