import { build5Db } from '@build-5/database';
import {
  ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE,
  BaseProposalAnswerValue,
  COL,
  DEFAULT_NETWORK,
  Member,
  Proposal,
  ProposalType,
  Space,
  SpaceGuardianUpsertTangleResponse,
  SUB_COL,
  TangleRequestType,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getProject } from '../../../../utils/common.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { editSpaceMemberSchemaObject } from './SpaceEditMemberTangleRequestSchema';

export class SpaceGuardianService extends BaseTangleService<SpaceGuardianUpsertTangleResponse> {
  public handleRequest = async ({
    order,
    owner,
    request,
  }: HandlerParams): Promise<SpaceGuardianUpsertTangleResponse> => {
    const type =
      request.requestType == TangleRequestType.SPACE_ADD_GUARDIAN
        ? ProposalType.ADD_GUARDIAN
        : ProposalType.REMOVE_GUARDIAN;

    const params = await assertValidationAsync(editSpaceMemberSchemaObject, request);

    const { proposal, voteTransaction, members } = await addRemoveGuardian(
      getProject(order),
      owner,
      { ...params },
      type,
    );

    const memberPromisses = members.map((member) =>
      build5Db().doc(COL.PROPOSAL, proposal.uid, SUB_COL.MEMBERS, member.uid).create(member),
    );
    await Promise.all(memberPromisses);

    this.transactionService.push({
      ref: build5Db().doc(COL.TRANSACTION, voteTransaction.uid),
      data: voteTransaction,
      action: Action.C,
    });
    this.transactionService.push({
      ref: build5Db().doc(COL.PROPOSAL, proposal.uid),
      data: proposal,
      action: Action.C,
    });

    return { proposal: proposal.uid };
  };
}

export const addRemoveGuardian = async (
  project: string,
  owner: string,
  params: Record<string, unknown>,
  type: ProposalType,
) => {
  const isAddGuardian = type === ProposalType.ADD_GUARDIAN;
  await assertIsGuardian(params.uid as string, owner);

  const spaceDocRef = build5Db().doc(COL.SPACE, params.uid as string);
  const spaceMemberDoc = await build5Db()
    .doc(COL.SPACE, params.uid as string, SUB_COL.MEMBERS, params.member as string)
    .get();
  if (!spaceMemberDoc) {
    throw invalidArgument(WenError.member_is_not_part_of_the_space);
  }

  const spaceGuardianMember = await build5Db()
    .doc(COL.SPACE, params.uid as string, SUB_COL.GUARDIANS, params.member as string)
    .get();
  if (isAddGuardian && spaceGuardianMember) {
    throw invalidArgument(WenError.member_is_already_guardian_of_space);
  } else if (!isAddGuardian && !spaceGuardianMember) {
    throw invalidArgument(WenError.member_is_not_guardian_of_space);
  }

  const ongoingProposalSnap = await build5Db()
    .collection(COL.PROPOSAL)
    .where('settings_addRemoveGuardian', '==', params.member as string)
    .where('completed', '==', false)
    .get();

  if (ongoingProposalSnap.length) {
    throw invalidArgument(WenError.ongoing_proposal);
  }

  if (!isAddGuardian) {
    await build5Db().runTransaction(async (transaction) => {
      const space = <Space>await transaction.get(spaceDocRef);
      if (space.totalGuardians < 2) {
        throw invalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
      }
    });
  }

  const guardian = <Member>await build5Db().doc(COL.MEMBER, owner).get();
  const member = <Member>await build5Db()
    .doc(COL.MEMBER, params.member as string)
    .get();
  const guardians = await build5Db()
    .collection(COL.SPACE, params.uid as string, SUB_COL.GUARDIANS)
    .get();
  const space = await spaceDocRef.get();
  const proposal = getProposalData(
    project,
    guardian,
    space!,
    member,
    isAddGuardian,
    guardians.length,
  );

  const voteTransaction: Transaction = {
    project,
    type: TransactionType.VOTE,
    uid: getRandomEthAddress(),
    member: owner,
    space: params.uid as string,
    network: DEFAULT_NETWORK,
    payload: {
      proposalId: proposal.uid,
      weight: 1,
      values: [1],
      votes: [],
    },
    linkedTransactions: [],
  };

  const members = guardians.map((guardian) => ({
    uid: guardian.uid,
    weight: 1,
    voted: guardian.uid === owner,
    tranId: guardian.uid === owner ? voteTransaction.uid : '',
    parentId: proposal.uid,
    parentCol: COL.SPACE,
    values: guardian.uid === owner ? [{ [1]: 1 }] : [],
  }));

  return { proposal, voteTransaction, members };
};

const getProposalData = (
  project: string,
  owner: Member,
  space: Space,
  member: Member,
  isAddGuardian: boolean,
  guardiansCount: number,
): Proposal => {
  const additionalInfo =
    `${owner.name || owner.uid} wants to ${isAddGuardian ? 'add' : 'remove'} ${member.name} as guardian. ` +
    `Request created on ${dayjs().format('MM/DD/YYYY')}. ` +
    `${ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE} % must agree for this action to proceed`;
  return {
    project,
    createdBy: owner.uid,
    uid: getRandomEthAddress(),
    name: `${isAddGuardian ? 'Add' : 'Remove'} guardian`,
    additionalInfo: additionalInfo,
    space: space.uid,
    description: '',
    type: isAddGuardian ? ProposalType.ADD_GUARDIAN : ProposalType.REMOVE_GUARDIAN,
    approved: true,
    rejected: false,
    settings: {
      startDate: dateToTimestamp(dayjs().toDate()),
      endDate: dateToTimestamp(dayjs().add(1, 'w').toDate()),
      guardiansOnly: true,
      addRemoveGuardian: member.uid,
    },
    questions: [
      {
        text: `Do you want to ${isAddGuardian ? 'add' : 'remove'} @${member.name} as guardian?`,
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
