import {
  ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE,
  BaseProposalAnswerValue,
  COL,
  DEFAULT_NETWORK,
  Member,
  Proposal,
  ProposalSubType,
  ProposalType,
  Space,
  SUB_COL,
  TangleRequestType,
  Transaction,
  TransactionType,
  VoteTransaction,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../../../admin.config';
import { editSpaceMemberSchema } from '../../../../runtime/firebase/space';
import { cOn, dateToTimestamp } from '../../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { TransactionService } from '../../transaction-service';

export class SpaceGuardianService {
  constructor(readonly transactionService: TransactionService) {}

  public handleEditGuardianRequest = async (owner: string, request: Record<string, unknown>) => {
    await assertValidationAsync(editSpaceMemberSchema, request, { allowUnknown: true });

    const type =
      request.requestType == TangleRequestType.SPACE_ADD_GUARDIAN
        ? ProposalType.ADD_GUARDIAN
        : ProposalType.REMOVE_GUARDIAN;
    const { proposal, voteTransaction, members } = await addRemoveGuardian(owner, request, type);

    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    const memberPromisses = members.map((member) => {
      proposalDocRef.collection(SUB_COL.MEMBERS).doc(member.uid).set(cOn(member));
    });
    await Promise.all(memberPromisses);

    const transactionDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
    this.transactionService.updates.push({
      ref: transactionDocRef,
      data: voteTransaction,
      action: 'set',
    });
    this.transactionService.updates.push({
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

  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.uid}`);
  const spaceMemberDoc = await spaceDocRef
    .collection(SUB_COL.MEMBERS)
    .doc(params.member as string)
    .get();
  if (!spaceMemberDoc.exists) {
    throw throwInvalidArgument(WenError.member_is_not_part_of_the_space);
  }

  const spaceGuardianMember = await spaceDocRef
    .collection(SUB_COL.GUARDIANS)
    .doc(params.member as string)
    .get();
  if (isAddGuardian && spaceGuardianMember.exists) {
    throw throwInvalidArgument(WenError.member_is_already_guardian_of_space);
  } else if (!isAddGuardian && !spaceGuardianMember.exists) {
    throw throwInvalidArgument(WenError.member_is_not_guardian_of_space);
  }

  const ongoingProposalSnap = await admin
    .firestore()
    .collection(COL.PROPOSAL)
    .where('settings.addRemoveGuardian', '==', params.member)
    .where('settings.endDate', '>=', dateToTimestamp(dayjs()))
    .get();

  if (ongoingProposalSnap.size) {
    throw throwInvalidArgument(WenError.ongoing_proposal);
  }

  if (!isAddGuardian) {
    await admin.firestore().runTransaction(async (transaction) => {
      const space = <Space>(await transaction.get(spaceDocRef)).data();
      if (space.totalGuardians < 2) {
        throw throwInvalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
      }
    });
  }

  const guardian = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${owner}`).get()).data();
  const member = <Member>(
    (await admin.firestore().doc(`${COL.MEMBER}/${params.member}`).get()).data()
  );
  const guardians = await admin
    .firestore()
    .collection(`${COL.SPACE}/${params.uid}/${SUB_COL.GUARDIANS}`)
    .get();
  const proposal = getProposalData(
    guardian,
    params.uid as string,
    member,
    isAddGuardian,
    guardians.size,
  );

  const voteTransaction = <Transaction>{
    type: TransactionType.VOTE,
    uid: getRandomEthAddress(),
    member: owner,
    space: params.uid,
    network: DEFAULT_NETWORK,
    payload: <VoteTransaction>{
      proposalId: proposal.uid,
      weight: 1,
      values: [1],
      votes: [],
    },
    linkedTransactions: [],
  };

  const members = guardians.docs.map((doc) => ({
    uid: doc.id,
    weight: 1,
    voted: doc.id === owner,
    tranId: doc.id === owner ? voteTransaction.uid : '',
    parentId: proposal.uid,
    parentCol: COL.PROPOSAL,
    values: doc.id === owner ? [{ [1]: 1 }] : [],
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
    `${owner.name} wants to ${isAddGuardian ? 'add' : 'remove'} ${member.name} as guardian. ` +
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
    subType: ProposalSubType.ONE_MEMBER_ONE_VOTE,
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
