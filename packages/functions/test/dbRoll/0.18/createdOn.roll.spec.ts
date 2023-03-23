import { COL } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { rollCreatedOn } from '../../../scripts/dbUpgrades/0.18/createdOn.roll';
import admin from '../../../src/admin.config';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Created on roll', () => {
  it('Should roll created on', async () => {
    const data = [
      { uid: getRandomEthAddress() },
      { uid: getRandomEthAddress(), createdOn: dateToTimestamp(dayjs().subtract(1, 'h')) },
    ];
    for (const d of data) {
      await admin.firestore().doc(`${COL.NFT}/${d.uid}`).create(d);
    }

    await rollCreatedOn(admin.app(), COL.NFT);

    for (const d of data) {
      const docRef = admin.firestore().doc(`${COL.NFT}/${d.uid}`);
      const doc = await docRef.get();
      expect(doc.data()?.createdOn).toEqual(doc.createTime);
    }
  });
});
