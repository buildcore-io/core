import { COL, Stake, StakeReward, StakeRewardStatus, StakeType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { getStakedPerMember } from '../../src/cron/stakeReward.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

const now = dayjs();
const cases = [
  {
    // 'All before',
    stakes: [
      { createdOn: now.subtract(4, 'd'), expiresAt: now.subtract(3, 'd') },
      { createdOn: now.subtract(2, 'd'), expiresAt: now.subtract(1, 'd') },
    ],
    reward: { startDate: now, endDate: now },
    expectedValue: 0,
  },
  {
    // 'All after',
    stakes: [
      { createdOn: now.add(1, 'd'), expiresAt: now.add(2, 'd') },
      { createdOn: now.add(3, 'd'), expiresAt: now.subtract(4, 'd') },
    ],
    reward: { startDate: now, endDate: now },
    expectedValue: 0,
  },
  {
    // 'One before, one half in left',
    stakes: [
      { createdOn: now.subtract(4, 'd'), expiresAt: now.subtract(3, 'd') },
      { createdOn: now.subtract(1, 'd'), expiresAt: now.add(1, 'h') },
    ],
    reward: { startDate: now, endDate: now.add(1, 'd') },
    expectedValue: 125,
  },
  {
    // 'One after, one half in right',
    stakes: [
      { createdOn: now.add(4, 'd'), expiresAt: now.add(5, 'd') },
      { createdOn: now.add(1, 'h'), expiresAt: now.add(2, 'd') },
    ],
    reward: { startDate: now, endDate: now.add(1, 'd') },
    expectedValue: 125,
  },
  {
    // 'One after, one in',
    stakes: [
      { createdOn: now.add(4, 'd'), expiresAt: now.add(5, 'd') },
      { createdOn: now.add(1, 'h'), expiresAt: now.add(2, 'h') },
    ],
    reward: { startDate: now, endDate: now.add(1, 'd') },
    expectedValue: 125,
  },
  {
    // 'One after, one in, one half in right',
    stakes: [
      { createdOn: now.add(4, 'd'), expiresAt: now.add(5, 'd') },
      { createdOn: now.add(1, 'h'), expiresAt: now.add(2, 'h') },
      { createdOn: now.add(1, 'h'), expiresAt: now.add(2, 'd') },
    ],
    reward: { startDate: now, endDate: now.add(1, 'd') },
    expectedValue: 250,
  },
  {
    // 'One after, two around',
    stakes: [
      { createdOn: now.add(4, 'd'), expiresAt: now.add(5, 'd') },
      { createdOn: now.subtract(1, 'd'), expiresAt: now.add(2, 'd') },
      { createdOn: now.subtract(3, 'd'), expiresAt: now.add(3, 'd') },
    ],
    reward: { startDate: now, endDate: now.add(1, 'd') },
    expectedValue: 250,
  },
  {
    // 'Two around',
    stakes: [
      { createdOn: now.subtract(1, 'd'), expiresAt: now.add(2, 'd') },
      { createdOn: now.subtract(3, 'd'), expiresAt: now.add(3, 'd') },
    ],
    reward: { startDate: now, endDate: now.add(1, 'd') },
    expectedValue: 250,
  },
  {
    // 'Two in',
    stakes: [
      { createdOn: now.add(1, 'h'), expiresAt: now.add(2, 'h') },
      { createdOn: now.add(2, 'h'), expiresAt: now.add(3, 'h') },
    ],
    reward: { startDate: now, endDate: now.add(1, 'd') },
    expectedValue: 250,
  },
  {
    // 'One left, one right',
    stakes: [
      { createdOn: now.subtract(3, 'd'), expiresAt: now.subtract(2, 'd') },
      { createdOn: now.add(2, 'd'), expiresAt: now.add(3, 'd') },
    ],
    reward: { startDate: now, endDate: now },
    expectedValue: 0,
  },
  {
    // 'Two left, but on in',
    stakes: [
      { createdOn: now.subtract(3, 'd'), expiresAt: now.add(1, 'y') },
      { createdOn: now.subtract(2, 'd'), expiresAt: now.subtract(1, 'm') },
    ],
    reward: { startDate: now, endDate: now },
    expectedValue: 125,
  },
];

describe('Stake reward cron: getStakedPerMember', () => {
  let member: string;
  let token: string;
  let space: string;

  beforeEach(() => {
    member = getRandomEthAddress();
    token = getRandomEthAddress();
    space = getRandomEthAddress();
  });

  const createStake = async (createdOn: dayjs.Dayjs, expiresAt: dayjs.Dayjs) => {
    const stake: Stake = {
      uid: getRandomEthAddress(),
      member,
      space,
      token,
      amount: 100,
      value: 125,
      weeks: 1,
      createdOn: dateToTimestamp(createdOn.toDate()),
      expiresAt: dateToTimestamp(expiresAt.toDate()),
      expirationProcessed: false,
      type: StakeType.DYNAMIC,
      orderId: '',
      billPaymentId: '',
      leftCheck: expiresAt.valueOf(),
      rightCheck: createdOn.valueOf(),
    };
    await admin.firestore().doc(`${COL.STAKE}/${stake.uid}`).create(stake);
    return stake;
  };

  const createReward = async (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
    const stakeReward = {
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(start.toDate()),
      endDate: dateToTimestamp(end.toDate()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),
      tokensToDistribute: 100,
      token,
      status: StakeRewardStatus.UNPROCESSED,
      leftCheck: start.valueOf(),
      rightCheck: end.valueOf(),
    } as StakeReward;
    await admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`).create(stakeReward);
    return stakeReward;
  };

  it.each(cases)('Test getStakedPerMember', async ({ stakes, reward, expectedValue }) => {
    for (const stake of stakes) {
      await createStake(stake.createdOn, stake.expiresAt);
    }
    const stakeReward = await createReward(reward.startDate, reward.endDate);
    const stakedPerMember = await getStakedPerMember(stakeReward);
    expect(stakedPerMember[member]).toBe(expectedValue || undefined);
  });
});
