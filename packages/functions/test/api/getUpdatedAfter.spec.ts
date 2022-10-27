import { PublicCollections, QUERY_MAX_LENGTH } from '@soon/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { getUpdatedAfter } from '../../src/api/getUpdatedAfter';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Get many by id', () => {
  it('Should get all', async () => {
    const count = QUERY_MAX_LENGTH + 1;
    const updatedOn = dayjs();
    const uids = Array.from(Array(count)).map(() => getRandomEthAddress());
    const batch = admin.firestore().batch();
    uids.forEach((uid, i) => {
      const docRef = admin.firestore().doc(`${PublicCollections.MEMBER}/${uid}`);
      batch.create(docRef, {
        name: 'asd',
        uid,
        updatedOn: dateToTimestamp(updatedOn.add(i ? 0 : 1, 's').toDate()),
      });
    });
    await batch.commit();
    let req = {
      body: { collection: PublicCollections.MEMBER, updatedAfter: updatedOn.toDate() },
    } as any;
    let res = {
      send: (body: any[]) => {
        expect(body.length).toBe(100);
      },
    } as any;
    await getUpdatedAfter(req, res);

    req = {
      body: {
        collection: PublicCollections.MEMBER,
        updatedAfter: updatedOn.add(1, 's').toDate(),
      },
    } as any;
    res = {
      send: (body: any[]) => {
        expect(body.length).toBe(1);
      },
    } as any;
    await getUpdatedAfter(req, res);
  });
});
