import { TIMELOCK_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { MAX_WEEKS_TO_STAKE } from '../../interfaces/config';
import { Network, Space, SpaceMember, Stake } from '../../interfaces/models';
import { COL, SUB_COL, Timestamp } from '../../interfaces/models/base';
import admin from '../../src/admin.config';
import { depositStake } from '../../src/controls/stake.control';
import { removeExpiredStakesFromSpace } from '../../src/cron/stake.cron';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
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

  const stakeAmount = async (amount: number, weeks = 26, expiresAt?: Timestamp) => {
    mockWalletReturnValue(helper.walletSpy, helper.member!.uid, {
      space: helper.space!.uid,
      weeks,
      network: helper.network,
    });
    const order = await testEnv.wrap(depositStake)({});
    await helper.walletService!.send(
      helper.memberAddress!,
      order.payload.targetAddress,
      order.payload.amount,
      {
        expiration: expiresAt
          ? { expiresAt, returnAddressBech32: helper.memberAddress!.bech32 }
          : undefined,
        nativeTokens: [{ id: helper.TOKEN_ID, amount: HexHelper.fromBigInt256(bigInt(amount)) }],
      },
    );
    await MnemonicService.store(
      helper.memberAddress!.bech32,
      helper.memberAddress!.mnemonic,
      Network.RMS,
    );
    const query = admin.firestore().collection(COL.STAKE).where('orderId', '==', order.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size == 1;
    });
    const stake = <Stake>(await query.get()).docs[0].data();
    expect(stake.amount).toBe(amount);
    expect(stake.member).toBe(helper.member!.uid);
    expect(stake.value).toBe(Math.floor(amount * (1 + weeks / MAX_WEEKS_TO_STAKE)));
    expect(stake.weeks).toBe(weeks);
    expect(stake.orderId).toBe(order.uid);

    await wait(async () => {
      const currSpace = <Space>(
        (await admin.firestore().doc(`${COL.SPACE}/${helper.space!.uid}`).get()).data()
      );
      return currSpace.stakeTotalAmount !== helper.space!.stakeTotalAmount;
    });
    helper.space = <Space>(
      (await admin.firestore().doc(`${COL.SPACE}/${helper.space!.uid}`).get()).data()
    );
    return stake;
  };

  const validateSpaceStakeAmount = async (
    stakeAmount: number,
    stakeTotalAmount: number,
    stakeValue: number,
    stakeTotalValue: number,
  ) => {
    helper.space = <Space>(
      (await admin.firestore().doc(`${COL.SPACE}/${helper.space!.uid}`).get()).data()
    );
    expect(helper.space!.stakeAmount).toBe(stakeAmount);
    expect(helper.space!.stakeTotalAmount).toBe(stakeTotalAmount);
    expect(helper.space!.stakeValue).toBe(stakeValue);
    expect(helper.space!.stakeTotalValue).toBe(stakeTotalValue);
  };

  const validateMemberStakeAmount = async (
    stakeAmount: number,
    stakeTotalAmount: number,
    stakeValue: number,
    stakeTotalValue: number,
  ) => {
    const memberData = <SpaceMember>(
      (
        await admin
          .firestore()
          .doc(`${COL.SPACE}/${helper.space!.uid}/${SUB_COL.MEMBERS}/${helper.member!.uid}`)
          .get()
      ).data()
    );
    expect(memberData.stakeAmount).toBe(stakeAmount);
    expect(memberData.stakeTotalAmount).toBe(stakeTotalAmount);
    expect(memberData.stakeValue).toBe(stakeValue);
    expect(memberData.stakeTotalValue).toBe(stakeTotalValue);
  };

  it.each([false, true])(
    'Should set take amount and remove it once expired',
    async (hasExpiration: boolean) => {
      const expiresAt = hasExpiration ? dateToTimestamp(dayjs().add(1, 'h').toDate()) : undefined;

      const stake1 = await stakeAmount(10, 26, expiresAt);
      await validateSpaceStakeAmount(10, 10, 15, 15);
      await validateMemberStakeAmount(10, 10, 15, 15);

      const stake2 = await stakeAmount(20, 26, expiresAt);
      await validateSpaceStakeAmount(30, 30, 45, 45);
      await validateMemberStakeAmount(30, 30, 45, 45);

      await removeExpiredStakesFromSpace();
      await validateSpaceStakeAmount(30, 30, 45, 45);
      await validateMemberStakeAmount(30, 30, 45, 45);

      await admin
        .firestore()
        .doc(`${COL.STAKE}/${stake2.uid}`)
        .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
      await removeExpiredStakesFromSpace();
      await validateSpaceStakeAmount(10, 30, 15, 45);
      await validateMemberStakeAmount(10, 30, 15, 45);

      await admin
        .firestore()
        .doc(`${COL.STAKE}/${stake1.uid}`)
        .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
      await removeExpiredStakesFromSpace();
      await validateSpaceStakeAmount(0, 30, 0, 45);
      await validateMemberStakeAmount(0, 30, 0, 45);

      const outputs = await helper.walletService!.getOutputs(
        helper.memberAddress!.bech32,
        [],
        true,
      );
      expect(Object.keys(outputs).length).toBe(2);
      const hasTimelock = Object.values(outputs).filter(
        (o) =>
          o.unlockConditions.find((u) => u.type === TIMELOCK_UNLOCK_CONDITION_TYPE) !== undefined,
      );
      expect(hasTimelock.length).toBe(2);
    },
  );

  it('Should set take amount and remove it once expired, 52 weeks', async () => {
    const stake1 = await stakeAmount(10, 52);
    await validateSpaceStakeAmount(10, 10, 20, 20);
    await validateMemberStakeAmount(10, 10, 20, 20);

    const stake2 = await stakeAmount(20, 52);
    await validateSpaceStakeAmount(30, 30, 60, 60);
    await validateMemberStakeAmount(30, 30, 60, 60);

    await removeExpiredStakesFromSpace();
    await validateSpaceStakeAmount(30, 30, 60, 60);
    await validateMemberStakeAmount(30, 30, 60, 60);

    await admin
      .firestore()
      .doc(`${COL.STAKE}/${stake2.uid}`)
      .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
    await removeExpiredStakesFromSpace();
    await validateSpaceStakeAmount(10, 30, 20, 60);
    await validateMemberStakeAmount(10, 30, 20, 60);

    await admin
      .firestore()
      .doc(`${COL.STAKE}/${stake1.uid}`)
      .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
    await removeExpiredStakesFromSpace();
    await validateSpaceStakeAmount(0, 30, 0, 60);
    await validateMemberStakeAmount(0, 30, 0, 60);

    const outputs = await helper.walletService!.getOutputs(helper.memberAddress!.bech32, [], true);
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
