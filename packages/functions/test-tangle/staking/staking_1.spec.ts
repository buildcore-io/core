import { TIMELOCK_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next';
import { COL, Space, StakeType, SUB_COL, WenError } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { depositStake } from '../../src/controls/stake.control';
import { removeExpiredStakesFromSpace } from '../../src/cron/stake.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import {
  addGuardianToSpace,
  createMember,
  expectThrow,
  mockWalletReturnValue,
} from '../../test/controls/common';
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
    const secondGuardian = await createMember(helper.walletSpy!);
    await addGuardianToSpace(helper.space?.uid!, secondGuardian);
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token?.uid!}/${SUB_COL.DISTRIBUTION}/${secondGuardian}`)
      .set({
        parentId: helper.token?.uid!,
        parentCol: COL.TOKEN,
        uid: secondGuardian,
        stakes: {
          [StakeType.DYNAMIC]: {
            amount: 10,
            totalAmount: 10,
            value: 10,
            totalValue: 10,
          },
        },
      });

    const expiresAt = expiration ? dateToTimestamp(dayjs().add(1, 'h').toDate()) : undefined;

    const stake1 = await helper.stakeAmount(10, 26, expiresAt, type);
    await helper.validateStatsStakeAmount(10, 10, 15, 15, type, 1);
    await helper.validateMemberStakeAmount(10, 10, 15, 15, type);
    await helper.assertDistributionStakeExpiry(stake1);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${helper.space?.uid}`);
    await spaceDocRef.update({ tokenBased: true, minStakedValue: 10 });

    const stake2 = await helper.stakeAmount(20, 26, expiresAt, type);
    await helper.validateStatsStakeAmount(30, 30, 45, 45, type, 1);
    await helper.validateMemberStakeAmount(30, 30, 45, 45, type);
    await helper.assertDistributionStakeExpiry(stake2);

    await removeExpiredStakesFromSpace();
    await helper.validateStatsStakeAmount(30, 30, 45, 45, type, 1);
    await helper.validateMemberStakeAmount(30, 30, 45, 45, type);
    await helper.assertDistributionStakeExpiry(stake1);
    await helper.assertDistributionStakeExpiry(stake2);

    await helper.updateStakeExpiresAt(stake2, dayjs().subtract(1, 'm'));
    await removeExpiredStakesFromSpace();
    await helper.validateStatsStakeAmount(10, 30, 15, 45, type, 1);
    await helper.validateMemberStakeAmount(10, 30, 15, 45, type);

    let space = <Space>(await spaceDocRef.get()).data();
    expect(space.totalMembers).toBe(2);
    expect(space.totalGuardians).toBe(2);

    await helper.updateStakeExpiresAt(stake1, dayjs().subtract(2, 'm'));
    await removeExpiredStakesFromSpace();
    await helper.validateStatsStakeAmount(0, 30, 0, 45, type, 0);
    await helper.validateMemberStakeAmount(0, 30, 0, 45, type);

    space = <Space>(await spaceDocRef.get()).data();
    expect(space.totalMembers).toBe(type === StakeType.DYNAMIC ? 1 : 2);
    expect(space.totalGuardians).toBe(type === StakeType.DYNAMIC ? 1 : 2);

    await helper.assertStakeExpiryCleared(type);

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
