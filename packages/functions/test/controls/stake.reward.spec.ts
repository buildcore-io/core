import { COL, Space, StakeReward, WenError } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { stakeReward } from '../../src/runtime/firebase/stake';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { createMember, createSpace, expectThrow, mockWalletReturnValue } from './common';

describe('Stake reward controller', () => {
  let walletSpy: any;
  let guardian: string;
  let space: Space;
  let token: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    token = wallet.getRandomEthAddress();
    await soonDb().doc(`${COL.TOKEN}/${token}`).create({ uid: token, space: space.uid });
  });

  it('Should throw, token does not exist', async () => {
    const items = [
      {
        startDate: dayjs().valueOf(),
        endDate: dayjs().add(2, 'd').valueOf(),
        tokenVestingDate: dayjs().add(3, 'd').valueOf(),
        tokensToDistribute: 100,
      },
    ];
    mockWalletReturnValue(walletSpy, guardian, { token: wallet.getRandomEthAddress(), items });
    await expectThrow(testEnv.wrap(stakeReward)({}), WenError.token_does_not_exist.key);
  });

  it('Should throw, not guardian', async () => {
    await soonDb().doc(`${COL.TOKEN}/${token}`).update({ space: wallet.getRandomEthAddress() });
    const items = [
      {
        startDate: dayjs().valueOf(),
        endDate: dayjs().add(2, 'd').valueOf(),
        tokenVestingDate: dayjs().add(3, 'd').valueOf(),
        tokensToDistribute: 100,
      },
    ];
    mockWalletReturnValue(walletSpy, guardian, { token, items });
    await expectThrow(testEnv.wrap(stakeReward)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should create rewards', async () => {
    const now = dayjs();
    const items = [
      {
        startDate: now.valueOf(),
        endDate: now.add(2, 'd').valueOf(),
        tokenVestingDate: now.add(3, 'd').valueOf(),
        tokensToDistribute: 100,
      },
    ];
    mockWalletReturnValue(walletSpy, guardian, { token, items: [items[0], items[0]] });
    const stakeRewards: StakeReward[] = await testEnv.wrap(stakeReward)({});
    expect(stakeRewards.length).toBe(2);

    for (const stakeReward of stakeRewards) {
      expect(stakeReward.uid).toBeDefined();
      expect(stakeReward.token).toBe(token);
      expect(
        dayjs(stakeReward.startDate.toDate()).isSame(
          dayjs(dateToTimestamp(dayjs(now.valueOf()).toDate()).toDate()),
        ),
      ).toBe(true);
      expect(
        dayjs(stakeReward.endDate.toDate()).isSame(
          dayjs(dateToTimestamp(dayjs(now.add(2, 'd').valueOf()).toDate()).toDate()),
        ),
      ).toBe(true);
      expect(
        dayjs(stakeReward.tokenVestingDate.toDate()).isSame(
          dayjs(dateToTimestamp(dayjs(now.add(3, 'd').valueOf()).toDate()).toDate()),
        ),
      ).toBe(true);
      expect(stakeReward.tokensToDistribute).toBe(100);
    }
  });

  it('Should throw, end date before start date', async () => {
    const now = dayjs();
    const items = [
      {
        startDate: now.valueOf(),
        endDate: now.subtract(2, 'd').valueOf(),
        tokenVestingDate: now.add(3, 'd').valueOf(),
        tokensToDistribute: 100,
      },
    ];
    mockWalletReturnValue(walletSpy, guardian, { token, items });
    await expectThrow(testEnv.wrap(stakeReward)({}), WenError.invalid_params.key);
  });

  it('Should throw, vesting date before end date', async () => {
    const now = dayjs();
    const items = [
      {
        startDate: now.valueOf(),
        endDate: now.add(2, 'd').valueOf(),
        tokenVestingDate: now.add(1, 'd').valueOf(),
        tokensToDistribute: 100,
      },
    ];
    mockWalletReturnValue(walletSpy, guardian, { token, items });
    await expectThrow(testEnv.wrap(stakeReward)({}), WenError.invalid_params.key);
  });
});
