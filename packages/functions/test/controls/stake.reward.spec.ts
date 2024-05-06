import { database } from '@buildcore/database';
import {
  COL,
  SOON_PROJECT_ID,
  Space,
  StakeReward,
  Token,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { mockWalletReturnValue, testEnv } from '../set-up';
import { expectThrow } from './common';

describe('Stake reward controller', () => {
  let guardian: string;
  let space: Space;
  let token: string;

  beforeEach(async () => {
    guardian = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    token = wallet.getRandomEthAddress();
    await database()
      .doc(COL.TOKEN, token)
      .create({
        project: SOON_PROJECT_ID,
        uid: token,
        space: space.uid,
        links: [] as URL[],
      } as Token);
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
    mockWalletReturnValue(guardian, { token: wallet.getRandomEthAddress(), items });
    await expectThrow(testEnv.wrap(WEN_FUNC.stakeReward), WenError.token_does_not_exist.key);
  });

  it('Should throw, not guardian', async () => {
    await database().doc(COL.TOKEN, token).update({ space: wallet.getRandomEthAddress() });
    const items = [
      {
        startDate: dayjs().valueOf(),
        endDate: dayjs().add(2, 'd').valueOf(),
        tokenVestingDate: dayjs().add(3, 'd').valueOf(),
        tokensToDistribute: 100,
      },
    ];
    mockWalletReturnValue(guardian, { token, items });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.stakeReward),
      WenError.you_are_not_guardian_of_space.key,
    );
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
    mockWalletReturnValue(guardian, { token, items: [items[0], items[0]] });
    const stakeRewards: StakeReward[] = await testEnv.wrap<StakeReward[]>(WEN_FUNC.stakeReward);
    expect(stakeRewards.length).toBe(2);

    for (let stakeReward of stakeRewards) {
      stakeReward = (await database().doc(COL.STAKE_REWARD, stakeReward.uid).get())!;
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
    mockWalletReturnValue(guardian, { token, items });
    await expectThrow(testEnv.wrap(WEN_FUNC.stakeReward), WenError.invalid_params.key);
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
    mockWalletReturnValue(guardian, { token, items });
    await expectThrow(testEnv.wrap(WEN_FUNC.stakeReward), WenError.invalid_params.key);
  });
});
