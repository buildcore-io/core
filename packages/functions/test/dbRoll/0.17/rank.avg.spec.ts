import { COL, SUB_COL } from '@soonaverse/interfaces';
import { roll as rankAvgRoll } from '../../../scripts/dbUpgrades/0_17/rank.avg.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';
describe('Rank avg roll', () => {
  it('Should set rank avg', async () => {
    const data = [
      {
        uid: getRandomEthAddress(),
      },
      {
        uid: getRandomEthAddress(),
        rankSum: 10,
        rankCount: 3,
      },
    ];
    for (const d of data) {
      await admin.firestore().doc(`${COL.TOKEN}/${d.uid}`).create(d);
      await admin.firestore().doc(`${COL.COLLECTION}/${d.uid}`).create(d);
    }

    await rankAvgRoll(admin.app());

    for (const col of [COL.TOKEN, COL.COLLECTION]) {
      const updatedData = [
        (await admin.firestore().doc(`${col}/${data[0].uid}`).get()).data()!,
        (await admin.firestore().doc(`${col}/${data[1].uid}`).get()).data()!,
      ];
      expect(updatedData[0].rankAvg).toBeUndefined();
      expect(updatedData[0].rankSum).toBeUndefined();
      expect(updatedData[0].rankCount).toBeUndefined();
      expect(updatedData[1].rankAvg).toBe(3.333);
      expect(updatedData[1].rankSum).toBe(10);
      expect(updatedData[1].rankCount).toBe(3);

      const stats = [
        (
          await admin.firestore().doc(`${col}/${data[0].uid}/${SUB_COL.STATS}/${data[0].uid}`).get()
        ).data()!,
        (
          await admin.firestore().doc(`${col}/${data[1].uid}/${SUB_COL.STATS}/${data[1].uid}`).get()
        ).data()!,
      ];
      expect(stats[0]).toBeUndefined();
      expect(stats[1].ranks.avg).toBe(3.333);
    }
  });
});
