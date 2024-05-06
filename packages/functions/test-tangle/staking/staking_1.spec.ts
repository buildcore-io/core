import { database } from '@buildcore/database';
import {
  calcStakedMultiplier,
  COL,
  Network,
  Space,
  StakeType,
  SUB_COL,
  Transaction,
  TransactionType,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import { UnlockConditionType } from '@iota/sdk';
import dayjs from 'dayjs';
import { removeExpiredStakesFromSpace } from '../../src/cron/stake.cron';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { addGuardianToSpace, expectThrow, wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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
      symbol: helper.token?.symbol,
      weeks: 10,
      type: StakeType.STATIC,
      customMetadata,
    };
    mockWalletReturnValue(helper.member!.uid, data);
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.depositStake),
      WenError.invalid_params.key,
    );

    delete customMetadata.key6;
    customMetadata.key5 = 12;
    mockWalletReturnValue(helper.member!.uid, { ...data, customMetadata });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.depositStake),
      WenError.invalid_params.key,
    );
  });

  it('Should throw, invalid weeks', async () => {
    let data = {
      symbol: helper.token?.symbol,
      weeks: 0,
      type: StakeType.STATIC,
    };
    mockWalletReturnValue(helper.member!.uid, data);
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.depositStake),
      WenError.invalid_params.key,
    );

    mockWalletReturnValue(helper.member!.uid, { ...data, weeks: 53 });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.depositStake),
      WenError.invalid_params.key,
    );
  });

  it.each([
    { expiration: false, type: StakeType.DYNAMIC },
    { expiration: false, type: StakeType.STATIC },
    { expiration: true, type: StakeType.DYNAMIC },
  ])('Should set stake amount and remove it once expired', async ({ expiration, type }) => {
    const secondGuardian = await testEnv.createMember();
    await addGuardianToSpace(helper.space?.uid!, secondGuardian);
    await database()
      .doc(COL.TOKEN, helper.token?.uid!, SUB_COL.DISTRIBUTION, secondGuardian)
      .upsert({
        parentId: helper.token?.uid!,
        stakes_dynamic_amount: 10,
        stakes_dynamic_totalAmount: 10,
        stakes_dynamic_value: 10,
        stakes_dynamic_totalValue: 10,
      });

    const expiresAt = expiration ? dateToTimestamp(dayjs().add(1, 'h').toDate()) : undefined;

    const stake1 = await helper.stakeAmount(10, 26, expiresAt, type);
    await helper.validateStatsStakeAmount(10, 10, 14, 14, type, 1);
    await helper.validateMemberStakeAmount(10, 10, 14, 14, type);
    await helper.assertDistributionStakeExpiry(stake1);

    const spaceDocRef = database().doc(COL.SPACE, helper.space?.uid!);
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

    let space = <Space>await spaceDocRef.get();
    expect(space.totalMembers).toBe(2);
    expect(space.totalGuardians).toBe(2);

    await helper.updateStakeExpiresAt(stake1, dayjs().subtract(2, 'm'));
    await removeExpiredStakesFromSpace();
    await helper.validateStatsStakeAmount(0, 30, 0, 43, type, 0);
    await helper.validateMemberStakeAmount(0, 30, 0, 43, type);

    space = <Space>await spaceDocRef.get();
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
      (o) => o.unlockConditions.find((u) => u.type === UnlockConditionType.Timelock) !== undefined,
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

    mockWalletReturnValue(helper.member!.uid, {
      symbol: helper.token?.symbol,
      weeks: 26,
      type: StakeType.DYNAMIC,
    });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.depositStake);

    await helper.walletService!.send(
      helper.memberAddress!,
      order.payload.targetAddress!,
      order.payload.amount!,
      {
        expiration: { expiresAt, returnAddressBech32: helper.memberAddress!.bech32 },
        nativeTokens: [{ id: helper.MINTED_TOKEN_ID, amount: BigInt(10) }],
      },
    );
    await MnemonicService.store(
      helper.memberAddress!.bech32,
      helper.memberAddress!.mnemonic,
      Network.RMS,
    );
    await wait(
      async () => {
        const snap = await database()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.UNLOCK)
          .where('member', '==', helper.member?.uid)
          .get();
        if (snap.length) {
          await database()
            .doc(COL.TRANSACTION, order.uid)
            .update({ payload_expiresOn: dayjs().subtract(1, 'd').toDate() });
        }
        return snap.length > 0;
      },
      6000,
      100,
    );

    const creditQuery = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.member?.uid);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length > 0;
    });
    const credits = await creditQuery.get();
    expect(credits.length).toBe(1);
    expect(credits[0]?.payload.targetAddress).toBe(helper.memberAddress?.bech32);
  });
});
