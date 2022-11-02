import { TIMELOCK_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next';
import { COL, StakeType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { removeExpiredStakesFromSpace } from '../../src/cron/stake.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { Helper } from './Helper';

describe('Staking test', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([
    { expiration: false, type: StakeType.DYNAMIC },
    { expiration: false, type: StakeType.STATIC },
    { expiration: true, type: StakeType.DYNAMIC },
  ])('Should set take amount and remove it once expired', async ({ expiration, type }) => {
    const expiresAt = expiration ? dateToTimestamp(dayjs().add(1, 'h').toDate()) : undefined;

    const stake1 = await helper.stakeAmount(10, 26, expiresAt, type);
    await helper.validateStatsStakeAmount(10, 10, 15, 15, type);
    await helper.validateMemberStakeAmount(10, 10, 15, 15, type);

    const stake2 = await helper.stakeAmount(20, 26, expiresAt, type);
    await helper.validateStatsStakeAmount(30, 30, 45, 45, type);
    await helper.validateMemberStakeAmount(30, 30, 45, 45, type);

    await removeExpiredStakesFromSpace();
    await helper.validateStatsStakeAmount(30, 30, 45, 45, type);
    await helper.validateMemberStakeAmount(30, 30, 45, 45, type);

    await admin
      .firestore()
      .doc(`${COL.STAKE}/${stake2.uid}`)
      .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
    await removeExpiredStakesFromSpace();
    await helper.validateStatsStakeAmount(10, 30, 15, 45, type);
    await helper.validateMemberStakeAmount(10, 30, 15, 45, type);

    await admin
      .firestore()
      .doc(`${COL.STAKE}/${stake1.uid}`)
      .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
    await removeExpiredStakesFromSpace();
    await helper.validateStatsStakeAmount(0, 30, 0, 45, type);
    await helper.validateMemberStakeAmount(0, 30, 0, 45, type);

    const outputs = await helper.walletService!.getOutputs(
      helper.memberAddress!.bech32,
      [],
      false,
      true,
    );
    expect(Object.keys(outputs).length).toBe(2);
    const hasTimelock = Object.values(outputs).filter(
      (o) =>
        o.unlockConditions.find((u) => u.type === TIMELOCK_UNLOCK_CONDITION_TYPE) !== undefined,
    );
    expect(hasTimelock.length).toBe(2);
  });

  afterAll(async () => {
    await helper.listenerRMS!.cancel();
  });
});
