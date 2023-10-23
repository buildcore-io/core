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
  SpaceMember,
  SUB_COL,
  TangleRequestType,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp, serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { TransactionService } from '../../transaction-service';
import { editSpaceMemberSchemaObject } from './SpaceEditMemberTangleRequestSchema';

export class SpaceGuardianService {
  constructor(readonly transactionService: TransactionService) {}

  public handleEditGuardianRequest = async (
    owner: string,
    request: Record<string, unknown>,
  ): Promise<SpaceGuardianUpsertTangleResponse> => {
    const type =
      request.requestType == TangleRequestType.SPACE_ADD_GUARDIAN
        ? ProposalType.ADD_GUARDIAN
        : ProposalType.REMOVE_GUARDIAN;

    const params = await assertValidationAsync(editSpaceMemberSchemaObject, request);

    const { proposal, voteTransaction, members } = await addRemoveGuardian(
      owner,
      { ...params },
      type,
    );

    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    const memberPromisses = members.map((member) => {
      proposalDocRef.collection(SUB_COL.MEMBERS).doc(member.uid).set(member);
    });
    await Promise.all(memberPromisses);

    const transactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
    this.transactionService.push({
      ref: transactionDocRef,
      data: voteTransaction,
      action: 'set',
    });
    this.transactionService.push({
      ref: proposalDocRef,
      data: proposal,
      action: 'set',
    });

    return { proposal: proposal.uid };
  };
}

export const addRemoveGuardian = async (
  owner: string,
  params: Record<string, unknown>,
  type: ProposalType,
) => {
  const isAddGuardian = type === ProposalType.ADD_GUARDIAN;
  await assertIsGuardian(params.uid as string, owner);

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
  const spaceMemberDoc = await spaceDocRef
    .collection(SUB_COL.MEMBERS)
    .doc(params.member as string)
    .get();
  if (!spaceMemberDoc) {
    throw invalidArgument(WenError.member_is_not_part_of_the_space);
  }

  const spaceGuardianMember = await spaceDocRef
    .collection(SUB_COL.GUARDIANS)
    .doc(params.member as string)
    .get();
  if (isAddGuardian && spaceGuardianMember) {
    throw invalidArgument(WenError.member_is_already_guardian_of_space);
  } else if (!isAddGuardian && !spaceGuardianMember) {
    throw invalidArgument(WenError.member_is_not_guardian_of_space);
  }

  const ongoingProposalSnap = await build5Db()
    .collection(COL.PROPOSAL)
    .where('settings.addRemoveGuardian', '==', params.member)
    .where('settings.endDate', '>=', serverTime())
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

  const guardian = <Member>await build5Db().doc(`${COL.MEMBER}/${owner}`).get();
  const member = <Member>await build5Db().doc(`${COL.MEMBER}/${params.member}`).get();
  const guardians = await build5Db()
    .doc(`${COL.SPACE}/${params.uid}`)
    .collection(SUB_COL.GUARDIANS)
    .get<SpaceMember>();
  const proposal = getProposalData(
    guardian,
    params.uid as string,
    member,
    isAddGuardian,
    guardians.length,
  );

  const voteTransaction: Transaction = {
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
    parentCol: COL.PROPOSAL,
    values: guardian.uid === owner ? [{ [1]: 1 }] : [],
  }));

  return { proposal, voteTransaction, members };
};

const getProposalData = (
  owner: Member,
  space: string,
  member: Member,
  isAddGuardian: boolean,
  guardiansCount: number,
) => {
  const additionalInfo =
    `${owner.name || owner.uid} wants to ${isAddGuardian ? 'add' : 'remove'} ${
      member.name
    } as guardian. ` +
    `Request created on ${dayjs().format('MM/DD/YYYY')}. ` +
    `${ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE} % must agree for this action to proceed`;
  return <Proposal>{
    createdBy: owner.uid,
    uid: getRandomEthAddress(),
    name: `${isAddGuardian ? 'Add' : 'Remove'} guardian`,
    additionalInfo: additionalInfo,
    space,
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
  };
};
