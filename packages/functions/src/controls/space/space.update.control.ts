import { build5Db } from '@build-5/database';
import {
  BaseProposalAnswerValue,
  COL,
  DEFAULT_NETWORK,
  Member,
  Proposal,
  ProposalType,
  Space,
  SpaceGuardian,
  SpaceUpdateRequest,
  SUB_COL,
  TokenStatus,
  Transaction,
  TransactionType,
  UPDATE_SPACE_THRESHOLD_PERCENTAGE,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { get, startCase } from 'lodash';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { cleanupParams } from '../../utils/schema.utils';
import { hasActiveEditProposal } from '../../utils/space.utils';
import { assertIsGuardian, getTokenForSpace } from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const updateSpaceControl = async ({ owner, params }: Context<SpaceUpdateRequest>) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
  const space = await spaceDocRef.get<Space>();

  if (!space) {
    throw invalidArgument(WenError.space_does_not_exists);
  }

  if (params.tokenBased) {
    const token = await getTokenForSpace(space.uid);
    if (token?.status !== TokenStatus.MINTED) {
      throw invalidArgument(WenError.token_not_minted);
    }
  }

  if (space.tokenBased && (params.open !== undefined || params.tokenBased !== undefined)) {
    throw invalidArgument(WenError.token_based_space_access_can_not_be_edited);
  }

  await assertIsGuardian(space.uid, owner);

  if (await hasActiveEditProposal(space.uid)) {
    throw invalidArgument(WenError.ongoing_proposal);
  }

  const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  const guardian = await guardianDocRef.get<Member>();
  const guardians = await spaceDocRef.collection(SUB_COL.GUARDIANS).get<SpaceGuardian>();

  const proposal = createUpdateSpaceProposal(
    space,
    guardian!,
    space.uid,
    guardians.length,
    cleanupParams({ ...params }) as Space,
  );

  const voteTransaction: Transaction = {
    type: TransactionType.VOTE,
    uid: getRandomEthAddress(),
    member: owner,
    space: params.uid,
    network: DEFAULT_NETWORK,
    payload: {
      proposalId: proposal.uid,
      weight: 1,
      values: [1],
      votes: [],
    },
    linkedTransactions: [],
  };

  const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  const memberPromisses = guardians.map((guardian) => {
    proposalDocRef
      .collection(SUB_COL.MEMBERS)
      .doc(guardian.uid)
      .set({
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

  await build5Db().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`).create(voteTransaction);

  await proposalDocRef.create(proposal);

  return (await proposalDocRef.get<Proposal>())!;
};

const createUpdateSpaceProposal = (
  prevSpace: Space,
  owner: Member,
  space: string,
  guardiansCount: number,
  spaceUpdateData: Space,
) => {
  const additionalInfo =
    `${owner.name || owner.uid} wants to edit the space. ` +
    `Request created on ${dayjs().format('MM/DD/YYYY')}. ` +
    `${UPDATE_SPACE_THRESHOLD_PERCENTAGE} % must agree for this action to proceed`;
  return <Proposal>{
    createdBy: owner.uid,
    uid: getRandomEthAddress(),
    name: 'Edit space',
    additionalInfo: additionalInfo,
    space,
    description: '',
    type: ProposalType.EDIT_SPACE,
    approved: true,
    rejected: false,
    settings: {
      startDate: dateToTimestamp(dayjs().toDate()),
      endDate: dateToTimestamp(dayjs().add(1, 'w').toDate()),
      guardiansOnly: true,
      spaceUpdateData: { ...spaceUpdateData },
    },
    questions: [
      {
        text: 'Do you want to edit the space?',
        additionalInfo: getSpaceDiffInfo(prevSpace, spaceUpdateData),
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
  };
};

const getSpaceDiffInfo = (prev: Space, change: Space) =>
  Object.entries(change).reduce((acc, [key, value]) => {
    if (key === 'uid' || value === null || value === get(prev, key)) {
      return acc;
    }
    return acc + `${startCase(key)}: ${value} (previously: ${get(prev, key, 'None')})\n`;
  }, 'Changes requested.<br />');
