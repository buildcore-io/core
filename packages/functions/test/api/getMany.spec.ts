import {
  PublicCollections,
  PublicSubCollections,
  QUERY_MAX_LENGTH,
  WenError,
} from '@build5/interfaces';
import { isEmpty, last } from 'lodash';
import { getMany } from '../../src/api/getMany';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Get all', () => {
  let space = '';

  beforeEach(() => {
    space = getRandomEthAddress();
  });

  it('Get all', async () => {
    const uid1 = getRandomEthAddress();
    const uid2 = getRandomEthAddress();
    await soonDb()
      .doc(`${PublicCollections.MEMBER}/${uid1}`)
      .create({ name: 'asd', uid: uid1, space });
    await soonDb()
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
    const batch = soonDb().batch();
    uids.forEach((uid, i) =>
      batch.create(soonDb().doc(`${PublicCollections.MEMBER}/${uid}`), {
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
    const batch = soonDb().batch();
    uids.forEach((uid, i) =>
      batch.create(soonDb().doc(`${PublicCollections.MEMBER}/${uid}`), {
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

  it('Get all, array query', async () => {
    const uids = Array.from(Array(4)).map(() => getRandomEthAddress());

    for (let i = 0; i < uids.length; ++i) {
      await soonDb()
        .doc(`${PublicCollections.MEMBER}/${uids[i]}`)
        .create({ uid: uids[i], space, small: i < 3, age: i < 3 ? 3 : 4 });
    }

    let req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: ['space', 'small', 'age'],
        fieldValue: [space, true, 3],
      },
    } as any;
    let res = {
      send: (body: any) => {
        expect(body.length).toBe(3);
      },
    } as any;
    await getMany(req, res);

    req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: ['space', 'small'],
        fieldValue: [space, false],
      },
    } as any;
    res = {
      send: (body: any) => {
        expect(body.length).toBe(1);
      },
    } as any;
    await getMany(req, res);

    req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: ['space', 'age'],
        fieldValue: [space, 4],
      },
    } as any;
    res = {
      send: (body: any) => {
        expect(body.length).toBe(1);
      },
    } as any;
    await getMany(req, res);
  });

  it('Should throw, fieldName type not equal fieldValue type', async () => {
    let req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: ['space'],
        fieldValue: space,
      },
    } as any;
    let res = {
      status: (status: number) => {
        expect(status).toBe(400);
      },
      send: (body: any) => {
        expect(body).toEqual(['"fieldValue" must be an array']);
      },
    } as any;
    await getMany(req, res);

    req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: 'space',
        fieldValue: [space],
      },
    } as any;
    res = {
      status: (status: number) => {
        expect(status).toBe(400);
      },
      send: (body: any) => {
        expect(body).toEqual(['"fieldValue" must be one of [boolean, number, string]']);
      },
    } as any;
    await getMany(req, res);
  });

  it('Should ge by boolean field', async () => {
    const randomFieldName = Math.random().toString().replace('0.', 'a');
    await soonDb()
      .doc(`${PublicCollections.MEMBER}/${getRandomEthAddress()}`)
      .create({ [randomFieldName]: false });

    const req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: randomFieldName,
        fieldValue: false,
      },
    } as any;
    const res = {
      send: (body: any) => {
        expect(body.length).toBe(1);
      },
    } as any;
    await getMany(req, res);
  });
});

describe('Get all sub', () => {
  it('Get all sub', async () => {
    const parentId = getRandomEthAddress();
    await soonDb().doc(`${PublicCollections.SPACE}/${parentId}`).create({ name: 'space' });
    const childrenCount = QUERY_MAX_LENGTH + 1;
    const childrenUids = Array.from(Array(childrenCount)).map(() => getRandomEthAddress());
    const batch = soonDb().batch();
    childrenUids.forEach((uid, i) => {
      const docRef = soonDb().doc(
        `${PublicCollections.SPACE}/${parentId}/${PublicSubCollections.MEMBERS}/${uid}`,
      );
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
    const batch = soonDb().batch();
    uids.forEach((uid, i) =>
      batch.create(soonDb().doc(`${PublicCollections.MEMBER}/${uid}`), {
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
    const batch = soonDb().batch();
    children.forEach((child, i) => {
      const docRef = soonDb().doc(
        `${PublicCollections.SPACE}/${space}/${PublicSubCollections.MEMBERS}/${child}`,
      );
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

describe('Get all with IN', () => {
  let space = '';

  beforeEach(() => {
    space = getRandomEthAddress();
  });

  it('Should get all with in filter', async () => {
    const count = 3;
    const members = Array.from(Array(count)).map(() => ({
      uid: getRandomEthAddress(),
      space,
    }));
    for (const member of members) {
      const docRef = soonDb().doc(`${PublicCollections.MEMBER}/${member.uid}`);
      await docRef.create(member);
    }

    const req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: ['uid', 'space', 'uid'],
        fieldValue: [members[0].uid, space, members[1].uid],
      },
    } as any;
    const res = {
      send: (body: any) => {
        expect(body.length).toBe(2);
      },
    } as any;
    await getMany(req, res);
  });

  it('Should throw, max 10 IN allowed', async () => {
    let req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: Array.from(Array(10)).map(() => 'uid'),
        fieldValue: Array.from(Array(10)).map(() => 'uid'),
      },
    } as any;
    let res = {
      send: (body: any) => {
        expect(body.length).toBe(0);
      },
    } as any;
    await getMany(req, res);

    req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: Array.from(Array(11)).map(() => 'uid'),
        fieldValue: Array.from(Array(11)).map(() => 'uid'),
      },
    } as any;
    res = {
      status: (status: number) => {
        expect(status).toBe(400);
      },
      send: (body: any) => {
        expect(body).toBe(WenError.max_10_fields.key);
      },
    } as any;
    await getMany(req, res);
  });

  it('Should throw, max 8 field allowed', async () => {
    let req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: Array.from(Array(8)).map((_, index) => index.toString()),
        fieldValue: Array.from(Array(8)).map(() => 'uid'),
      },
    } as any;
    let res = {
      send: (body: any) => {
        expect(body.length).toBe(0);
      },
    } as any;
    await getMany(req, res);

    req = {
      query: {
        collection: PublicCollections.MEMBER,
        fieldName: Array.from(Array(9)).map((_, index) => index.toString()),
        fieldValue: Array.from(Array(9)).map(() => 'uid'),
      },
    } as any;
    res = {
      status: (status: number) => {
        expect(status).toBe(400);
      },
      send: (body: any) => {
        expect(body).toBe(WenError.max_8_unique_field_names.key);
      },
    } as any;
    await getMany(req, res);
  });
});
