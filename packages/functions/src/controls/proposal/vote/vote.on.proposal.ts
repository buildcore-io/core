import {
  COL,
  DEFAULT_NETWORK,
  Proposal,
  ProposalMember,
  ProposalType,
  SUB_COL,
  Transaction,
  TransactionType,
  VoteTransaction,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../../../admin.config';
import { scale } from '../../../scale.settings';
import { CommonJoi } from '../../../services/joi/common';
import { throwInvalidArgument } from '../../../utils/error.utils';
import { appCheck } from '../../../utils/google.utils';
import { assertValidationAsync } from '../../../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../../../utils/wallet.utils';
import { executeSimpleVoting } from './simple.voting';
import { voteWithStakedTokens } from './staked.token.voting';
import { createVoteTransactionOrder } from './token.voting';

const voteOnProposalSchema = Joi.object({
  uid: CommonJoi.uid(),
  values: Joi.array().items(Joi.number()).min(1).max(1).unique().required(),
  voteWithStakedTokes: Joi.bool().optional(),
});

export const voteOnProposal = functions
  .runWith({ minInstances: scale(WEN_FUNC.voteOnProposal) })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.voteOnProposal, context);
    const params = await decodeAuth(req, WEN_FUNC.voteOnProposal);
    const owner = params.address.toLowerCase();
    await assertValidationAsync(voteOnProposalSchema, params.body);

    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${params.body.uid}`);
    const proposal = await getProposal(params.body.uid);

    const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(owner);
    const proposalMember = <ProposalMember | undefined>(await proposalMemberDocRef.get()).data();
    if (!proposalMember) {
      throw throwInvalidArgument(WenError.you_are_not_allowed_to_vote_on_this_proposal);
    }
    assertAnswerIsValid(proposal, params.body.values[0]);

    if (proposal.type === ProposalType.NATIVE) {
      if (params.body.voteWithStakedTokes) {
        return voteWithStakedTokens(proposal, proposalMember, params.body.values);
      }
      return createVoteTransactionOrder(proposal, owner, params.body.values);
    }

    return await executeSimpleVoting(proposal, proposalMember, params.body);
  });

const getProposal = async (uid: string) => {
  const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${uid}`);
  const proposal = <Proposal | undefined>(await proposalDocRef.get()).data();
  if (!proposal) {
    throw throwInvalidArgument(WenError.proposal_does_not_exists);
  }

  if (proposal.rejected) {
    throw throwInvalidArgument(WenError.proposal_is_rejected);
  }

  if (!proposal.approved) {
    throw throwInvalidArgument(WenError.proposal_is_not_approved);
  }
  const isNativeProposal = proposal.type === ProposalType.NATIVE;
  const startDate = dayjs(proposal.settings.startDate.toDate()).subtract(
    isNativeProposal ? 1 : 0,
    'd',
  );
  const endDate = dayjs(proposal.settings.endDate.toDate());
  if (dayjs().isBefore(startDate) || dayjs().isAfter(endDate)) {
    throw throwInvalidArgument(WenError.vote_is_no_longer_active);
  }

  if (endDate.isBefore(startDate)) {
    throw throwInvalidArgument(WenError.proposal_start_date_must_be_before_end_date);
  }

  return proposal;
};

const assertAnswerIsValid = (proposal: Proposal, answerSent: number) => {
  for (const question of proposal.questions) {
    for (const answer of question.answers) {
      if (answer.value === answerSent) {
        return;
      }
    }
  }
  throw throwInvalidArgument(WenError.value_does_not_exists_in_proposal);
};

export const createVoteTransaction = (
  proposal: Proposal,
  owner: string,
  weight: number,
  values: number[],
  stakes: string[] = [],
) =>
  <Transaction>{
    type: TransactionType.VOTE,
    uid: getRandomEthAddress(),
    member: owner,
    space: proposal.space,
    network: DEFAULT_NETWORK,
    payload: <VoteTransaction>{
      proposalId: proposal.uid,
      weight,
      values,
      votes: [],
      stakes,
    },
    linkedTransactions: [],
  };
