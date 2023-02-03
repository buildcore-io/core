import {
  COL,
  Proposal,
  ProposalMember,
  ProposalStartDateMin,
  ProposalSubType,
  ProposalType,
  SpaceMember,
  SUB_COL,
  TokenStatus,
  Transaction,
  TransactionAwardType,
  URL_PATHS,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { isProdEnv } from '../../utils/config.utils';
import { cOn, dateToTimestamp } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { getTokenForSpace } from '../../utils/token.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';

const createProposalScheam = {
  name: Joi.string().required(),
  space: CommonJoi.uid(),
  additionalInfo: Joi.string().allow(null, '').optional(),
  type: Joi.number().equal(ProposalType.MEMBERS, ProposalType.NATIVE).required(),
  subType: Joi.when('type', {
    is: Joi.exist().valid(ProposalType.NATIVE),
    then: Joi.number().equal(ProposalSubType.ONE_MEMBER_ONE_VOTE).required(),
    otherwise: Joi.number()
      .equal(
        ProposalSubType.ONE_MEMBER_ONE_VOTE,
        ProposalSubType.REPUTATION_BASED_ON_AWARDS,
        ProposalSubType.REPUTATION_BASED_ON_SPACE,
        ProposalSubType.REPUTATION_BASED_ON_SPACE_WITH_ALLIANCE,
      )
      .required(),
  }),
  settings: Joi.object({
    startDate: isProdEnv()
      ? Joi.date()
          .greater(Date.now() + ProposalStartDateMin.value)
          .required()
      : Joi.date().required(),
    endDate: Joi.date().greater(Joi.ref('startDate')).required(),
    onlyGuardians: Joi.boolean().required(),
    awards: Joi.when('...subType', {
      is: Joi.exist().valid(ProposalSubType.REPUTATION_BASED_ON_AWARDS),
      then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
      otherwise: Joi.forbidden(),
    }),
    defaultMinWeight: Joi.when('...subType', {
      is: Joi.exist().valid(
        ProposalSubType.REPUTATION_BASED_ON_SPACE,
        ProposalSubType.REPUTATION_BASED_ON_SPACE_WITH_ALLIANCE,
        ProposalSubType.REPUTATION_BASED_ON_AWARDS,
      ),
      then: Joi.number().optional(),
      otherwise: Joi.forbidden(),
    }),
  }).required(),
  questions: Joi.array()
    .items(
      Joi.object().keys({
        text: Joi.string().required(),
        additionalInfo: Joi.string().allow(null, '').optional(),
        answers: Joi.array()
          .items(
            Joi.object().keys({
              value: Joi.number().required(),
              text: Joi.string().required(),
              additionalInfo: Joi.string().allow(null, '').optional(),
            }),
          )
          .min(2)
          .required(),
        // To enable more questions, fix front-end. Also tweak voteOnProposal to validate.
      }),
    )
    .min(1)
    .max(1)
    .required(),
};

export const createProposal = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cProposal),
    timeoutSeconds: 300,
    memory: '2GB',
  })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.cProposal, context);
    const params = await decodeAuth(req, WEN_FUNC.cProposal);
    const owner = params.address.toLowerCase();

    const schema = Joi.object(createProposalScheam);
    await assertValidationAsync(schema, params.body);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.body.space}`);
    const spaceMemberDoc = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner).get();
    if (!spaceMemberDoc.exists) {
      throw throwInvalidArgument(WenError.you_are_not_part_of_space);
    }

    if (params.body.type === ProposalType.NATIVE) {
      const token = await getTokenForSpace(params.body.space);
      if (token?.status !== TokenStatus.MINTED) {
        throw throwInvalidArgument(WenError.token_not_minted);
      }
      params.body.token = token.uid;
    }

    const proposal: Proposal = {
      ...params.body,
      settings: {
        ...params.body.settings,
        startDate: dateToTimestamp(params.body.settings.startDate, true),
        endDate: dateToTimestamp(params.body.settings.endDate, true),
      },
      uid: getRandomEthAddress(),
      rank: 1,
      createdBy: owner,
      approved: false,
      rejected: false,
    };

    const totalWeight = await createProposalMembersAndGetTotalWeight(proposal);
    const results = {
      total: totalWeight * proposal.questions.length,
      voted: 0,
    };

    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    await proposalDocRef.set(cOn({ ...proposal, totalWeight, results }, URL_PATHS.PROPOSAL));

    await proposalDocRef
      .collection(SUB_COL.OWNERS)
      .doc(owner)
      .set(
        cOn({
          uid: owner,
          parentId: proposal.uid,
          parentCol: COL.PROPOSAL,
        }),
      );

    return <Proposal>(await proposalDocRef.get()).data();
  });

const createProposalMembersAndGetTotalWeight = async (proposal: Proposal) => {
  const spaceMembers = await getSpaceMembers(proposal.space, proposal.settings.onlyGuardians);
  const promises = spaceMembers.map(async (spaceMember) => {
    const proposalMember = await createProposalMember(proposal, spaceMember);
    if (proposalMember.weight || proposal.type === ProposalType.NATIVE) {
      await admin
        .firestore()
        .collection(`${COL.PROPOSAL}/${proposal.uid}/${SUB_COL.MEMBERS}`)
        .doc(spaceMember.uid)
        .set(cOn(proposalMember));
    }
    return proposalMember.weight || 0;
  });

  const proposalMemberWeights = await Promise.all(promises);
  return proposalMemberWeights.reduce((acc, act) => acc + act, 0);
};

const getSpaceMembers = async (space: string, guardiansOnly: boolean) => {
  const snap = await admin
    .firestore()
    .collection(COL.SPACE)
    .doc(space)
    .collection(guardiansOnly ? SUB_COL.GUARDIANS : SUB_COL.MEMBERS)
    .get();
  return snap.docs.map((doc) => doc.data() as SpaceMember);
};

const createProposalMember = async (proposal: Proposal, spaceMember: SpaceMember) => {
  const defaultWeight = proposal.settings.defaultMinWeight || 0;
  const votingWeight = await calculateVotingWeight(proposal, spaceMember.uid);
  const weight = Math.max(votingWeight, defaultWeight);
  return <ProposalMember>{
    uid: spaceMember.uid,
    weight,
    voted: false,
    parentId: proposal.uid,
    parentCol: COL.PROPOSAL,
  };
};

const getBadgesForMember = async (member: string) => {
  const snap = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.type', '==', TransactionAwardType.BADGE)
    .where('member', '==', member)
    .get();
  return snap.docs.map((doc) => doc.data() as Transaction);
};

const calculateVotingWeight = async (proposal: Proposal, member: string) => {
  if (proposal.type === ProposalType.NATIVE) {
    return 0;
  }
  if (
    proposal.subType === ProposalSubType.REPUTATION_BASED_ON_SPACE ||
    proposal.subType === ProposalSubType.REPUTATION_BASED_ON_SPACE_WITH_ALLIANCE ||
    proposal.subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS
  ) {
    const badges = await getBadgesForMember(member);
    return badges.reduce((acc, badge) => acc + getReputationFromBadge(proposal, badge), 0);
  }
  return 1;
};

const getReputationFromBadge = (proposal: Proposal, badge: Transaction) => {
  if (proposal.subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS) {
    if (proposal.settings.awards.includes(badge.payload.award)) {
      return badge.payload?.tokenReward || 0;
    }
    return 0;
  }
  if (badge.space === proposal.space) {
    return Math.trunc(badge.payload?.tokenReward || 0);
  }
  return 0;
};
