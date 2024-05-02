import { build5Db } from '@build-5/database';
import {
  BaseProposalAnswerValue,
  COL,
  DEFAULT_NETWORK,
  Member,
  Proposal,
  ProposalType,
  REMOVE_STAKE_REWARDS_THRESHOLD_PERCENTAGE,
  Space,
  StakeReward,
  SUB_COL,
  Timestamp,
  TokenStakeRewardsRemoveRequest,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { uniq } from 'lodash';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsTokenGuardian } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const removeStakeRewardControl = async ({
  project,
  owner,
  params,
}: Context<TokenStakeRewardsRemoveRequest>) => {
  const stakeRewardIds = params.stakeRewardIds as string[];
  const stakeRewardPromises = stakeRewardIds.map(async (stakeId) => {
    const docRef = build5Db().doc(COL.STAKE_REWARD, stakeId);
    return await docRef.get();
  });
  const stakeRewards = await Promise.all(stakeRewardPromises);
  stakeRewards.sort((a, b) => a!.startDate.seconds - b!.startDate.seconds);

  if (stakeRewards.find((reward) => reward === undefined)) {
    throw invalidArgument(WenError.invalid_params);
  }

  const proposalEndDate = stakeRewards[0]!.startDate;
  if (dayjs().isAfter(dayjs(proposalEndDate.toDate()))) {
    throw invalidArgument(WenError.stake_reward_started);
  }

  const tokenIds = uniq(stakeRewards.map((reward) => reward!.token));
  if (tokenIds.length > 1) {
    throw invalidArgument(WenError.invalid_params);
  }

  const tokenDocRef = build5Db().doc(COL.TOKEN, tokenIds[0]);
  const token = (await tokenDocRef.get())!;

  await assertIsTokenGuardian(token, owner);

  const ongoingProposalSnap = await build5Db()
    .collection(COL.PROPOSAL)
    .where('space', '==', token.space)
    .where('completed', '==', false)
    .get();
  if (ongoingProposalSnap.length) {
    throw invalidArgument(WenError.ongoing_proposal);
  }

  const guardianDocRef = build5Db().doc(COL.MEMBER, owner);
  const guardian = (await guardianDocRef.get())!;
  const guardians = await build5Db().collection(COL.SPACE, token.space, SUB_COL.GUARDIANS).get();

  const spaceDocRef = build5Db().doc(COL.SPACE, token.space!);
  const space = await spaceDocRef.get();
  const proposal = createUpdateSpaceProposal(
    project,
    guardian,
    space!,
    guardians.length,
    stakeRewards as StakeReward[],
    proposalEndDate,
  );

  const voteTransaction: Transaction = {
    project,
    type: TransactionType.VOTE,
    uid: getRandomEthAddress(),
    member: owner,
    space: token.space,
    network: DEFAULT_NETWORK,
    payload: {
      proposalId: proposal.uid,
      weight: 1,
      values: [1],
      votes: [],
    },
    linkedTransactions: [],
  };

  const proposalDocRef = build5Db().doc(COL.PROPOSAL, proposal.uid);
  const memberPromisses = guardians.map((guardian) => {
    build5Db()
      .doc(COL.PROPOSAL, proposal.uid, SUB_COL.MEMBERS, guardian.uid)
      .create({
        project,
        uid: guardian.uid,
        weight: 1,
        voted: guardian.uid === owner,
        tranId: guardian.uid === owner ? voteTransaction.uid : '',
        parentId: proposal.uid,
        parentCol: COL.PROPOSAL,
        values: guardian.uid === owner ? [{ [1]: 1 }] : [],
      });
  });
  await Promise.all(memberPromisses);

  await build5Db().doc(COL.TRANSACTION, voteTransaction.uid).create(voteTransaction);

  await proposalDocRef.create(proposal);

  return (await proposalDocRef.get())!;
};

const createUpdateSpaceProposal = (
  project: string,
  owner: Member,
  space: Space,
  guardiansCount: number,
  stakeRewards: StakeReward[],
  endDate: Timestamp,
): Proposal => {
  const additionalInfo =
    `${owner.name || owner.uid} wants to remove stake rewards. ` +
    `Request created on ${dayjs().format('MM/DD/YYYY')}.` +
    `${REMOVE_STAKE_REWARDS_THRESHOLD_PERCENTAGE} % must agree for this action to proceed <br /><br />`;
  return {
    project,
    createdBy: owner.uid,
    description: '',
    uid: getRandomEthAddress(),
    name: 'Remove stake rewards',
    additionalInfo: additionalInfo + getDescription(stakeRewards),
    space: space.uid,
    type: ProposalType.REMOVE_STAKE_REWARD,
    approved: true,
    rejected: false,
    settings: {
      startDate: dateToTimestamp(dayjs().toDate()),
      endDate,
      guardiansOnly: true,
      stakeRewardIds: stakeRewards.map((stakeReward) => stakeReward.uid),
    },
    questions: [
      {
        text: 'Do you want to remove stake rewards?',
        additionalInfo: '',
        answers: [
          {
            text: 'No',
            value: BaseProposalAnswerValue.NO,
            additionalInfo: '',
          },
          {
            text: 'Yes',
            value: BaseProposalAnswerValue.YES,
            additionalInfo: '',
          },
        ],
      },
    ],
    totalWeight: guardiansCount,
    results: {
      total: guardiansCount,
      voted: 1,
      answers: { [1]: 1 },
    },
    completed: false,
  };
};

const getDescription = (stakeRewards: StakeReward[]) => {
  const description =
    `| Start Date | End Date | Token Vesting Date | Tokens To Distribute |<br />` +
    '| --- | --- | --- | --- |<br />';
  const rewardsInfo = stakeRewards.map(stakeRewardToInfo).join('<br />');
  return description + rewardsInfo;
};

const stakeRewardToInfo = (stakeReward: StakeReward) =>
  `| ${dayjs(stakeReward.startDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
  `| ${dayjs(stakeReward.endDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
  `| ${dayjs(stakeReward.tokenVestingDate.toDate()).format('MM/DD/YYYY HH:mm (Z)')} ` +
  `| ${stakeReward.tokensToDistribute} |`;
