import {
  COL,
  MIN_IOTA_AMOUNT,
  Transaction,
  TransactionAwardType,
  TransactionType,
} from '@soonaverse/interfaces';
import { badgeTransactionRolls } from '../../../scripts/dbUpgrades/0_18/badge.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Roll legacy badge trans', () => {
  it('Should roll legacy badge trans', async () => {
    const count = 600;
    const badges = Array.from(Array(count)).map((_, i) => ({
      uid: getRandomEthAddress(),
      type: 'BADGE',
      payload: { type: '', xp: i },
    }));

    let batch = admin.firestore().batch();
    for (let i = 0; i < badges.length; ++i) {
      const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${badges[i].uid}`);
      batch.create(docRef, badges[i]);
      if (i % 499 === 0) {
        await batch.commit();
        batch = admin.firestore().batch();
      }
    }
    await batch.commit();

    await badgeTransactionRolls(admin.app());

    for (let i = 0; i < badges.length; ++i) {
      const docRef = admin.firestore().doc(`${COL.TRANSACTION}/${badges[i].uid}`);
      const badge = <Transaction>(await docRef.get()).data();
      expect(badge.type).toBe(TransactionType.AWARD);
      expect(badge.payload.type).toBe(TransactionAwardType.BADGE);
      expect(badge.payload.tokenReward).toBe(i * MIN_IOTA_AMOUNT);
    }
  });
});
