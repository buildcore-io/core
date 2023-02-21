import {
  Award,
  COL,
  Network,
  Transaction,
  TransactionOrderType,
  TransactionType,
} from '@soonaverse/interfaces';
import { awardImageMigration } from '../../scripts/dbUpgrades/0_18/award.image.migration';
import admin from '../../src/admin.config';
import { awardRoll } from '../../src/firebase/functions/dbRoll/award.roll';
import { xpTokenGuardianId, xpTokenId } from '../../src/utils/config.utils';
import { Helper } from './Helper';

describe('Award roll test', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  const createAndSaveAward = async (func: () => any) => {
    const legacyAward = func();
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${legacyAward.uid}`);
    await awardDocRef.create(legacyAward);
    return legacyAward;
  };

  it('Should roll award', async () => {
    const awards = [
      await createAndSaveAward(helper.newAward),
      await createAndSaveAward(helper.halfCompletedAward),
      await createAndSaveAward(helper.halfCompletedAward),
    ];

    await awardImageMigration(admin.app());

    let order: Transaction = {} as any;
    const req = { body: {} } as any;
    const res = {
      send: (response: Transaction) => {
        order = response;
      },
    } as any;
    await awardRoll(req, res);
    await awardRoll(req, res);

    const promises = awards.map(async (award) => {
      const docRef = admin.firestore().doc(`${COL.AWARD}/${award.uid}`);
      return <Award>(await docRef.get()).data();
    });
    const migratedAwards = await Promise.all(promises);
    migratedAwards.forEach(assertAwardFundOrder);
    const totalAmount = migratedAwards.reduce(
      (sum, award) =>
        sum +
        award.aliasStorageDeposit +
        award.collectionStorageDeposit +
        award.nttStorageDeposit +
        award.nativeTokenStorageDeposit,
      0,
    );
    const totalReward = migratedAwards.reduce(
      (sum, act) => sum + act.badge.tokenReward * act.badge.total,
      0,
    );
    expect(order.payload.amount).toBe(totalAmount);
    expect(order.payload.nativeTokens[0].amount).toBe(totalReward);
  });
});

const assertAwardFundOrder = async (award: Award) => {
  const ordersSnap = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.award', '==', award.uid)
    .where('payload.type', '==', TransactionOrderType.FUND_AWARD)
    .get();
  const order = <Transaction>ordersSnap.docs[0].data();
  expect(order.type).toBe(TransactionType.ORDER);
  expect(order.member).toBe(xpTokenGuardianId());
  expect(order.space).toBe(award.space);
  expect(order.network).toBe(Network.RMS);
  expect(order.payload.type).toBe(TransactionOrderType.FUND_AWARD);
  expect(order.payload.amount).toBe(
    award.aliasStorageDeposit +
      award.collectionStorageDeposit +
      award.nttStorageDeposit +
      award.nativeTokenStorageDeposit,
  );
  expect(order.payload.nativeTokens[0].id).toBe(xpTokenId());
  expect(order.payload.nativeTokens[0].amount).toBe(award.badge.tokenReward * award.badge.total);
};
