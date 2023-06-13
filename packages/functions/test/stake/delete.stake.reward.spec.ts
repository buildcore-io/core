import {
  COL,
  Proposal,
  ProposalType,
  Space,
  StakeReward,
  StakeRewardStatus,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { voteOnProposal } from '../../src/runtime/firebase/proposal';
import { removeStakeReward } from '../../src/runtime/firebase/stake';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import {
  addGuardianToSpace,
  createMember,
  createSpace,
  expectThrow,
  mockWalletReturnValue,
  wait,
} from '../controls/common';
import { testEnv } from '../set-up';

let walletSpy: any;

describe('Delete stake reward', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let token: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);

    await addGuardianToSpace(space.uid, member);

    token = wallet.getRandomEthAddress();
    await build5Db().doc(`${COL.TOKEN}/${token}`).create({ uid: token, space: space.uid });
  });

  const createStakeRewards = async () => {
    const now = dayjs();
    const stakeRewards = [
      {
        uid: wallet.getRandomEthAddress(),
        startDate: dateToTimestamp(now.add(2, 'd')),
        endDate: dateToTimestamp(now.add(3, 'd')),
        tokenVestingDate: dateToTimestamp(now.add(1, 'y')),
        tokensToDistribute: 123,
        token,
        status: StakeRewardStatus.UNPROCESSED,
      },
      {
        uid: wallet.getRandomEthAddress(),
        startDate: dateToTimestamp(now.add(1, 'd')),
        endDate: dateToTimestamp(now.add(2, 'd')),
        tokenVestingDate: dateToTimestamp(now.add(1, 'y')),
        tokensToDistribute: 123,
        token,
        status: StakeRewardStatus.UNPROCESSED,
      },
    ];
    for (const stakeReward of stakeRewards) {
      await build5Db().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`).create(stakeReward);
    }
    return stakeRewards;
  };

  const getStakeRewards = async (stakeRewardIds: string[]) => {
    const promises = stakeRewardIds.map(async (stakeRewardId) => {
      const docRef = build5Db().doc(`${COL.STAKE_REWARD}/${stakeRewardId}`);
      return <StakeReward>await docRef.get();
    });
    return await Promise.all(promises);
  };

  it('Should create proposal and delete stake reward', async () => {
    const stakeRewards = await createStakeRewards();
    const stakeRewardIds = stakeRewards.map((reward) => reward.uid);
    mockWalletReturnValue(walletSpy, guardian, {
      stakeRewardIds,
    });
    let proposal: Proposal = await testEnv.wrap(removeStakeReward)({});
    expect(proposal.settings.stakeRewardIds.sort()).toEqual(stakeRewardIds.sort());
    expect(
      dayjs(proposal.settings.endDate.toDate()).isSame(dayjs(stakeRewards[1].startDate.toDate())),
    ).toBe(true);
    expect(proposal.type).toBe(ProposalType.REMOVE_STAKE_REWARD);
    expect(proposal.approved).toBe(true);
    expect(proposal.results?.total).toBe(2);
    expect(proposal.results?.voted).toBe(1);
    expect(proposal.results?.answers).toEqual({ [1]: 1 });
    expect(proposal.name).toBe('Remove stake rewards');

    expect(proposal.additionalInfo).toContain(
      '| Start Date | End Date | Token Vesting Date | Tokens To Distribute |<br />' +
        '| --- | --- | --- | --- |<br />' +
        `| ${dayjs(stakeRewards[1].startDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
        `| ${dayjs(stakeRewards[1].endDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
        `| ${dayjs(stakeRewards[1].tokenVestingDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
        `| ${stakeRewards[1].tokensToDistribute} |<br />` +
        `| ${dayjs(stakeRewards[0].startDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
        `| ${dayjs(stakeRewards[0].endDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
        `| ${dayjs(stakeRewards[0].tokenVestingDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
        `| ${stakeRewards[0].tokensToDistribute} |`,
    );

    mockWalletReturnValue(walletSpy, member, { uid: proposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await wait(async () => {
      const stakeRewards = await getStakeRewards(stakeRewardIds);
      const allDeleted = stakeRewards.reduce(
        (acc, act) => acc && act.status === StakeRewardStatus.DELETED,
        true,
      );
      return allDeleted;
    });

    proposal = <Proposal>await build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`).get();
    expect(dayjs(proposal.settings.endDate.toDate()).isBefore(dayjs())).toBe(true);
  });

  it('Should throw, not guardian', async () => {
    const tmp = await createMember(walletSpy);
    const stakeRewards = await createStakeRewards();
    const stakeRewardIds = stakeRewards.map((reward) => reward.uid);
    mockWalletReturnValue(walletSpy, tmp, { stakeRewardIds });
    await expectThrow(
      testEnv.wrap(removeStakeReward)({}),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should throw, multiple tokens', async () => {
    const stakeRewards = await createStakeRewards();
    await build5Db().doc(`${COL.STAKE_REWARD}/${stakeRewards[0].uid}`).update({ token: 'asd' });
    const stakeRewardIds = stakeRewards.map((reward) => reward.uid);
    mockWalletReturnValue(walletSpy, guardian, { stakeRewardIds });
    await expectThrow(testEnv.wrap(removeStakeReward)({}), WenError.invalid_params.key);
  });

  it('Should throw, 2 ongoing proposals', async () => {
    const stakeRewards = await createStakeRewards();
    const stakeRewardIds = stakeRewards.map((reward) => reward.uid);
    mockWalletReturnValue(walletSpy, guardian, { stakeRewardIds });
    await testEnv.wrap(removeStakeReward)({});

    mockWalletReturnValue(walletSpy, guardian, { stakeRewardIds });
    await expectThrow(testEnv.wrap(removeStakeReward)({}), WenError.ongoing_proposal.key);
  });

  it('Should throw, stake reward expired', async () => {
    const stakeRewards = await createStakeRewards();
    const docRef = build5Db().doc(`${COL.STAKE_REWARD}/${stakeRewards[1].uid}`);
    await docRef.update({ startDate: dateToTimestamp(dayjs().subtract(1, 'm')) });

    const stakeRewardIds = stakeRewards.map((reward) => reward.uid);
    mockWalletReturnValue(walletSpy, guardian, {
      stakeRewardIds,
    });
    await expectThrow(testEnv.wrap(removeStakeReward)({}), WenError.stake_reward_started.key);
  });
});
