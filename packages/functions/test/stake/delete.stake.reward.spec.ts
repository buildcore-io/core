import { database } from '@buildcore/database';
import {
  COL,
  Proposal,
  ProposalType,
  SOON_PROJECT_ID,
  Space,
  StakeReward,
  StakeRewardStatus,
  Token,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { addGuardianToSpace, expectThrow, wait } from '../controls/common';
import { mockWalletReturnValue, testEnv } from '../set-up';

describe('Delete stake reward', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let token: string;

  beforeEach(async () => {
    guardian = await testEnv.createMember();
    member = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);

    await addGuardianToSpace(space.uid, member);

    token = wallet.getRandomEthAddress();
    await database()
      .doc(COL.TOKEN, token)
      .create({
        project: SOON_PROJECT_ID,
        space: space.uid,
        links: [] as URL[],
      } as Token);
  });

  const createStakeRewards = async () => {
    const now = dayjs();
    const stakeRewards = [
      {
        project: SOON_PROJECT_ID,
        uid: wallet.getRandomEthAddress(),
        startDate: dateToTimestamp(now.add(2, 'd')),
        endDate: dateToTimestamp(now.add(3, 'd')),
        tokenVestingDate: dateToTimestamp(now.add(1, 'y')),
        tokensToDistribute: 123,
        token,
        status: StakeRewardStatus.UNPROCESSED,
      },
      {
        project: SOON_PROJECT_ID,
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
      await database().doc(COL.STAKE_REWARD, stakeReward.uid).create(stakeReward);
    }
    return stakeRewards;
  };

  const getStakeRewards = async (stakeRewardIds: string[]) => {
    const promises = stakeRewardIds.map(async (stakeRewardId) => {
      const docRef = database().doc(COL.STAKE_REWARD, stakeRewardId);
      return <StakeReward>await docRef.get();
    });
    return await Promise.all(promises);
  };

  it('Should create proposal and delete stake reward', async () => {
    const stakeRewards = await createStakeRewards();
    const stakeRewardIds = stakeRewards.map((reward) => reward.uid);
    mockWalletReturnValue(guardian, { stakeRewardIds });
    let proposal = await testEnv.wrap<Proposal>(WEN_FUNC.removeStakeReward);
    proposal = (await database().doc(COL.PROPOSAL, proposal.uid).get())!;
    expect(proposal.settings.stakeRewardIds!.sort()).toEqual(stakeRewardIds.sort());
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

    mockWalletReturnValue(member, { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await wait(async () => {
      const stakeRewards = await getStakeRewards(stakeRewardIds);
      const allDeleted = stakeRewards.reduce(
        (acc, act) => acc && act.status === StakeRewardStatus.DELETED,
        true,
      );
      return allDeleted;
    });

    proposal = <Proposal>await database().doc(COL.PROPOSAL, proposal.uid).get();
    expect(dayjs(proposal.settings.endDate.toDate()).isBefore(dayjs())).toBe(true);
  });

  it('Should throw, not guardian', async () => {
    const tmp = await testEnv.createMember();
    const stakeRewards = await createStakeRewards();
    const stakeRewardIds = stakeRewards.map((reward) => reward.uid);
    mockWalletReturnValue(tmp, { stakeRewardIds });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.removeStakeReward),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should throw, multiple tokens', async () => {
    const stakeRewards = await createStakeRewards();
    await database().doc(COL.STAKE_REWARD, stakeRewards[0].uid).update({ token: 'name' });
    const stakeRewardIds = stakeRewards.map((reward) => reward.uid);
    mockWalletReturnValue(guardian, { stakeRewardIds });
    await expectThrow(testEnv.wrap(WEN_FUNC.removeStakeReward), WenError.invalid_params.key);
  });

  it('Should throw, 2 ongoing proposals', async () => {
    const stakeRewards = await createStakeRewards();
    const stakeRewardIds = stakeRewards.map((reward) => reward.uid);
    mockWalletReturnValue(guardian, { stakeRewardIds });
    await testEnv.wrap(WEN_FUNC.removeStakeReward);

    mockWalletReturnValue(guardian, { stakeRewardIds });
    await expectThrow(testEnv.wrap(WEN_FUNC.removeStakeReward), WenError.ongoing_proposal.key);
  });

  it('Should throw, stake reward expired', async () => {
    const stakeRewards = await createStakeRewards();
    const docRef = database().doc(COL.STAKE_REWARD, stakeRewards[1].uid);
    await docRef.update({ startDate: dayjs().subtract(1, 'm').toDate() });

    const stakeRewardIds = stakeRewards.map((reward) => reward.uid);
    mockWalletReturnValue(guardian, {
      stakeRewardIds,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.removeStakeReward), WenError.stake_reward_started.key);
  });
});
