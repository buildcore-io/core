import { TIMELOCK_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import {
  calcStakedMultiplier,
  COL,
  Network,
  Space,
  StakeType,
  SUB_COL,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { depositStake } from '../../src/controls/stake.control';
import { removeExpiredStakesFromSpace } from '../../src/cron/stake.cron';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import {
  addGuardianToSpace,
  createMember,
  expectThrow,
  mockWalletReturnValue,
  wait,
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
    await helper.validateStatsStakeAmount(10, 10, 14, 14, type, 1);
    await helper.validateMemberStakeAmount(10, 10, 14, 14, type);
    await helper.assertDistributionStakeExpiry(stake1);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${helper.space?.uid}`);
    await spaceDocRef.update({ tokenBased: true, minStakedValue: 10 });

    const stake2 = await helper.stakeAmount(20, 26, expiresAt, type);
    await helper.validateStatsStakeAmount(30, 30, 43, 43, type, 1);
    await helper.validateMemberStakeAmount(30, 30, 43, 43, type);
    await helper.assertDistributionStakeExpiry(stake2);

    await removeExpiredStakesFromSpace();
    await helper.validateStatsStakeAmount(30, 30, 43, 43, type, 1);
    await helper.validateMemberStakeAmount(30, 30, 43, 43, type);
    await helper.assertDistributionStakeExpiry(stake1);
    await helper.assertDistributionStakeExpiry(stake2);

    await helper.updateStakeExpiresAt(stake2, dayjs().subtract(1, 'm'));
    await removeExpiredStakesFromSpace();
    await helper.validateStatsStakeAmount(10, 30, 14, 43, type, 1);
    await helper.validateMemberStakeAmount(10, 30, 14, 43, type);

    let space = <Space>(await spaceDocRef.get()).data();
    expect(space.totalMembers).toBe(2);
    expect(space.totalGuardians).toBe(2);

    await helper.updateStakeExpiresAt(stake1, dayjs().subtract(2, 'm'));
    await removeExpiredStakesFromSpace();
    await helper.validateStatsStakeAmount(0, 30, 0, 43, type, 0);
    await helper.validateMemberStakeAmount(0, 30, 0, 43, type);

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

  it('Validate multiplier', async () => {
    const expected = Array.from(Array(52)).map((_, week) =>
      Number(((1 / 51) * (week + 1) + 2 - (1 / 51) * 52).toFixed(8)),
    );
    for (let i = 1; i <= 52; ++i) {
      expect(calcStakedMultiplier(i)).toBe(expected[i - 1]);
    }
  });

  it('Should credit invalid stake payment', async () => {
    const expiresAt = dateToTimestamp(dayjs().add(1, 'h').toDate());

    mockWalletReturnValue(helper.walletSpy, helper.member!.uid, {
      token: helper.token?.uid,
      weeks: 26,
      type: StakeType.DYNAMIC,
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
        nativeTokens: [{ id: helper.TOKEN_ID, amount: HexHelper.fromBigInt256(bigInt(10)) }],
      },
    );
    await MnemonicService.store(
      helper.memberAddress!.bech32,
      helper.memberAddress!.mnemonic,
      Network.RMS,
    );
    await wait(
      async () => {
        const snap = await admin
          .firestore()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.UNLOCK)
          .where('member', '==', helper.member?.uid)
          .get();
        if (snap.size) {
          await admin
            .firestore()
            .doc(`${COL.TRANSACTION}/${order.uid}`)
            .update({ 'payload.expiresOn': dateToTimestamp(dayjs().subtract(1, 'd')) });
        }
        return snap.size > 0;
      },
      6000,
      100,
    );

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.member?.uid);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.size > 0;
    });
    const credits = await creditQuery.get();
    expect(credits.size).toBe(1);
    expect(credits.docs[0].data()?.payload.targetAddress).toBe(helper.memberAddress?.bech32);
  });
});
