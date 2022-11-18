import { TIMELOCK_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next';
import { COL, StakeType, WenError } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { depositStake } from '../../src/controls/stake.control';
import { removeExpiredStakesFromSpace } from '../../src/cron/stake.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { expectThrow, mockWalletReturnValue } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Staking test', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should throw, invalid customMetadata', async () => {
    let customMetadata = <any>{
      key1: 'key1',
      key2: 'key1',
      key3: 'key1',
      key4: 'key1',
      key5: 'key1',
      key6: 'key',
    };
    let data = {
      token: helper.token?.uid,
      weeks: 10,
      type: StakeType.STATIC,
      customMetadata,
    };
    mockWalletReturnValue(helper.walletSpy, helper.member!.uid, data);
    await expectThrow(testEnv.wrap(depositStake)({}), WenError.invalid_params.key);

    delete customMetadata.key6;
    customMetadata.key5 = 12;
    mockWalletReturnValue(helper.walletSpy, helper.member!.uid, { ...data, customMetadata });
    await expectThrow(testEnv.wrap(depositStake)({}), WenError.invalid_params.key);
  });

  it('Should throw, invalid weeks', async () => {
    let data = {
      token: helper.token?.uid,
      weeks: 0,
      type: StakeType.STATIC,
    };
    mockWalletReturnValue(helper.walletSpy, helper.member!.uid, data);
    await expectThrow(testEnv.wrap(depositStake)({}), WenError.invalid_params.key);

    mockWalletReturnValue(helper.walletSpy, helper.member!.uid, { ...data, weeks: 53 });
    await expectThrow(testEnv.wrap(depositStake)({}), WenError.invalid_params.key);
  });

  it.each([
    { expiration: false, type: StakeType.DYNAMIC },
    { expiration: false, type: StakeType.STATIC },
    { expiration: true, type: StakeType.DYNAMIC },
  ])('Should set stake amount and remove it once expired', async ({ expiration, type }) => {
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
});
