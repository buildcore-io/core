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
  Transaction,
  TransactionType,
  URL_PATHS,
  VoteTransaction,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { cOn, dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';

export const addGuardian = functions
  .runWith({
    minInstances: scale(WEN_FUNC.addGuardianSpace),
  })
  .https.onCall(async (req, context) => {
    appCheck(WEN_FUNC.addGuardianSpace, context);
    return await addRemoveGuardian(req, ProposalType.ADD_GUARDIAN, WEN_FUNC.addGuardianSpace);
  });

export const removeGuardian = functions
  .runWith({
    minInstances: scale(WEN_FUNC.removeGuardianSpace),
  })
  .https.onCall(async (req, context) => {
    appCheck(WEN_FUNC.removeGuardianSpace, context);
    return await addRemoveGuardian(req, ProposalType.REMOVE_GUARDIAN, WEN_FUNC.removeGuardianSpace);
  });

const addRemoveGuardianSchema = Joi.object({
  uid: CommonJoi.uid(),
  member: CommonJoi.uid(),
});

const addRemoveGuardian = async (req: WenRequest, type: ProposalType, func: WEN_FUNC) => {
  const isAddGuardian = type === ProposalType.ADD_GUARDIAN;
  const params = await decodeAuth(req, func);
  const owner = params.address.toLowerCase();
  await assertValidationAsync(addRemoveGuardianSchema, params.body);

  await assertIsGuardian(params.body.uid, owner);

  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.body.uid}`);
  const spaceMemberDoc = await spaceDocRef
    .collection(SUB_COL.MEMBERS)
    .doc(params.body.member)
    .get();
  if (!spaceMemberDoc.exists) {
    throw throwInvalidArgument(WenError.member_is_not_part_of_the_space);
  }

  const spaceGuardianMember = await spaceDocRef
    .collection(SUB_COL.GUARDIANS)
    .doc(params.body.member)
    .get();
  if (isAddGuardian && spaceGuardianMember.exists) {
    throw throwInvalidArgument(WenError.member_is_already_guardian_of_space);
  } else if (!isAddGuardian && !spaceGuardianMember.exists) {
    throw throwInvalidArgument(WenError.member_is_not_guardian_of_space);
  }

  const ongoingProposalSnap = await admin
    .firestore()
    .collection(COL.PROPOSAL)
    .where('settings.addRemoveGuardian', '==', params.body.member)
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
    (await admin.firestore().doc(`${COL.MEMBER}/${params.body.member}`).get()).data()
  );
  const guardians = await admin
    .firestore()
    .collection(`${COL.SPACE}/${params.body.uid}/${SUB_COL.GUARDIANS}`)
    .get();
  const proposal = createAddRemoveGuardianProposal(
    guardian,
    params.body.uid,
    member,
    isAddGuardian,
    guardians.size,
  );

  const voteTransaction = <Transaction>{
    type: TransactionType.VOTE,
    uid: getRandomEthAddress(),
    member: owner,
    space: params.body.uid,
    network: DEFAULT_NETWORK,
    payload: <VoteTransaction>{
      proposalId: proposal.uid,
      weight: 1,
      values: [1],
      votes: [],
    },
    linkedTransactions: [],
  };

  const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  const memberPromisses = guardians.docs.map((doc) => {
    proposalDocRef
      .collection(SUB_COL.MEMBERS)
      .doc(doc.id)
      .set(
        cOn({
          uid: doc.id,
          weight: 1,
          voted: doc.id === owner,
          tranId: doc.id === owner ? voteTransaction.uid : '',
          parentId: proposal.uid,
          parentCol: COL.PROPOSAL,
          values: doc.id === owner ? [{ [1]: 1 }] : [],
        }),
      );
  });
  await Promise.all(memberPromisses);

  await admin
    .firestore()
    .doc(`${COL.TRANSACTION}/${voteTransaction.uid}`)
    .create(cOn(voteTransaction));

  await proposalDocRef.create(cOn(proposal, URL_PATHS.PROPOSAL));

  return <Proposal>(await proposalDocRef.get()).data();
};

const createAddRemoveGuardianProposal = (
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
