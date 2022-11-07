import { PublicCollections, PublicSubCollections, QUERY_MAX_LENGTH } from '@soonaverse/interfaces';
import { isEmpty, last } from 'lodash';
import admin from '../../src/admin.config';
import { getMany } from '../../src/api/getMany';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Get all', () => {
  let space = '';

  beforeEach(() => {
    space = getRandomEthAddress();
  });

  it('Get all', async () => {
    const uid1 = getRandomEthAddress();
    const uid2 = getRandomEthAddress();
    await admin
      .firestore()
      .doc(`${PublicCollections.MEMBER}/${uid1}`)
      .create({ name: 'asd', uid: uid1, space });
    await admin
      .firestore()
      .doc(`${PublicCollections.MEMBER}/${uid2}`)
      .create({ name: 'ccc', uid: uid2, space });
    const req = {
      query: { collection: PublicCollections.MEMBER, fieldName: 'space', fieldValue: space },
    } as any;
    const res = {
      send: (body: any) => {
        expect(body.length).toBeGreaterThan(0);
        const allHaveIds = body.reduce((acc: any, act: any) => acc && !isEmpty(act.id), true);
        expect(allHaveIds).toBe(true);
        expect(body.length).toBeLessThanOrEqual(QUERY_MAX_LENGTH);
      },
    } as any;
    await getMany(req, res);
  });

  it('Get all, but not more then max query', async () => {
    const uids = Array.from(Array(QUERY_MAX_LENGTH + 1)).map(() => getRandomEthAddress());
    const batch = admin.firestore().batch();
    uids.forEach((uid, i) =>
      batch.create(admin.firestore().doc(`${PublicCollections.MEMBER}/${uid}`), {
        name: 'asd' + i,
        uid,
        space,
      }),
    );
    await batch.commit();
    const req = {
      query: { collection: PublicCollections.MEMBER, fieldName: 'space', fieldValue: space },
    } as any;
    const res = {
      send: (body: any) => {
        const allHaveIds = body.reduce((acc: any, act: any) => acc && !isEmpty(act.id), true);
        expect(allHaveIds).toBe(true);
        expect(body.length).toBe(QUERY_MAX_LENGTH);
      },
    } as any;
    await getMany(req, res);
  });

  it('Get all paginated', async () => {
    const uids = Array.from(Array(QUERY_MAX_LENGTH + 1)).map(() => getRandomEthAddress());
    const batch = admin.firestore().batch();
    uids.forEach((uid, i) =>
      batch.create(admin.firestore().doc(`${PublicCollections.MEMBER}/${uid}`), {
        name: 'asd' + i,
        uid,
        space,
      }),
    );
    await batch.commit();
    let result1 = [] as any[];
    let req = {
      query: { collection: PublicCollections.MEMBER, fieldName: 'space', fieldValue: space },
    } as any;
    let res = {
      send: (body: any[]) => {
        expect(body.length).toBe(QUERY_MAX_LENGTH);
        result1 = body;
      },
    } as any;
    await getMany(req, res);

    req = {
      query: {
        collection: PublicCollections.MEMBER,
        startAfter: last(result1)?.uid,
        fieldName: 'space',
        fieldValue: space,
      },
    } as any;
    res = {
      send: (body: any[]) => {
        expect(body.length).toBe(1);
      },
    } as any;
    await getMany(req, res);
  });
});

describe('Get all sub', () => {
  it('Get all sub', async () => {
    const parentId = getRandomEthAddress();
    await admin.firestore().doc(`${PublicCollections.SPACE}/${parentId}`).create({ name: 'space' });
    const childrenCount = QUERY_MAX_LENGTH + 1;
    const childrenUids = Array.from(Array(childrenCount)).map(() => getRandomEthAddress());
    const batch = admin.firestore().batch();
    childrenUids.forEach((uid, i) => {
      const docRef = admin
        .firestore()
        .doc(`${PublicCollections.SPACE}/${parentId}/${PublicSubCollections.MEMBERS}/${uid}`);
      batch.create(docRef, { name: 'asd' + i, uid });
    });
    await batch.commit();

    let result = [] as any[];
    let req = {
      query: {
        collection: PublicCollections.SPACE,
        uid: parentId,
        subCollection: PublicSubCollections.MEMBERS,
      },
    } as any;
    let res = {
      send: (body: any) => {
        expect(body.length).toBe(QUERY_MAX_LENGTH);
        result = body;
      },
    } as any;
    await getMany(req, res);

    req = {
      query: {
        collection: PublicCollections.SPACE,
        uid: parentId,
        subCollection: PublicSubCollections.MEMBERS,
        startAfter: last(result)?.uid,
      },
    } as any;
    res = {
      send: (body: any) => {
        expect(body.length).toBe(1);
      },
    } as any;
    await getMany(req, res);
  });
});

describe('Get by field name', () => {
  it.each([getRandomEthAddress(), Math.random()])('Should get by field', async (field: any) => {
    const uids = Array.from(Array(QUERY_MAX_LENGTH + 1)).map(() => getRandomEthAddress());
    const batch = admin.firestore().batch();
    uids.forEach((uid, i) =>
      batch.create(admin.firestore().doc(`${PublicCollections.MEMBER}/${uid}`), {
        field,
        name: 'asd' + i,
        uid,
      }),
    );
    await batch.commit();

    let result = [] as any[];
    let req = {
      query: { collection: PublicCollections.MEMBER, fieldName: 'field', fieldValue: field },
    } as any;
    let res = {
      send: (body: any[]) => {
        expect(body.length).toBe(QUERY_MAX_LENGTH);
        result = body;
      },
    } as any;
    await getMany(req, res);

    req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: 'field',
        fieldValue: field,
        startAfter: last(result)?.uid,
      },
    } as any;
    res = {
      send: (body: any[]) => {
        expect(body.length).toBe(1);
      },
    } as any;
    await getMany(req, res);
  });
});

describe('Get subs by field name', () => {
  it.each([getRandomEthAddress()])('Should get subs by field', async (field: any) => {
    const space = getRandomEthAddress();
    const children = Array.from(Array(2 * QUERY_MAX_LENGTH)).map(() => getRandomEthAddress());
    const batch = admin.firestore().batch();
    children.forEach((child, i) => {
      const docRef = admin
        .firestore()
        .doc(`${PublicCollections.SPACE}/${space}/${PublicSubCollections.MEMBERS}/${child}`);
      const data = i <= QUERY_MAX_LENGTH ? { field } : { field: 'asd' };
      batch.create(docRef, { ...data, uid: child });
    });
    await batch.commit();

    let result = [] as any[];
    let req = {
      query: {
        collection: PublicCollections.SPACE,
        uid: space,
        subCollection: PublicSubCollections.MEMBERS,
        fieldName: 'field',
        fieldValue: field,
      },
    } as any;
    let res = {
      send: (body: any[]) => {
        expect(body.length).toBe(QUERY_MAX_LENGTH);
        result = body;
      },
    } as any;
    await getMany(req, res);

    req = {
      query: {
        collection: PublicCollections.SPACE,
        uid: space,
        subCollection: PublicSubCollections.MEMBERS,
        fieldName: 'field',
        fieldValue: field,
        startAfter: last(result)?.uid,
      },
    } as any;
    res = {
      send: (body: any[]) => {
        expect(body.length).toBe(1);
      },
    } as any;
    await getMany(req, res);
  });
});