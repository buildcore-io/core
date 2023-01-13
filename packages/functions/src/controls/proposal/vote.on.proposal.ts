import {
  COL,
  DEFAULT_NETWORK,
  Network,
  Proposal,
  ProposalMember,
  ProposalType,
  RelatedRecordsResponse,
  SUB_COL,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  VoteTransaction,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { head } from 'lodash';
import admin, { inc } from '../../admin.config';
import { scale } from '../../scale.settings';
import { CommonJoi } from '../../services/joi/common';
import { WalletService } from '../../services/wallet/wallet';
import { generateRandomAmount } from '../../utils/common.utils';
import { isProdEnv } from '../../utils/config.utils';
import { cOn, dateToTimestamp, serverTime, uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';
import { appCheck } from '../../utils/google.utils';
import { assertValidationAsync } from '../../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../../utils/wallet.utils';

export const voteOnProposal = functions
  .runWith({ minInstances: scale(WEN_FUNC.voteOnProposal) })
  .https.onCall(async (req: WenRequest, context) => {
    appCheck(WEN_FUNC.voteOnProposal, context);
    const params = await decodeAuth(req, WEN_FUNC.voteOnProposal);
    const owner = params.address.toLowerCase();
    const schema = Joi.object({
      uid: CommonJoi.uid(),
      values: Joi.array().items(Joi.number()).min(1).max(1).unique().required(),
    });
    await assertValidationAsync(schema, params.body);

    const proposalDocRef = admin.firestore().doc(`${COL.PROPOSAL}/${params.body.uid}`);
    const proposal = await getProposal(params.body.uid);

    const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(owner);
    const proposalMember = <ProposalMember | undefined>(await proposalMemberDocRef.get()).data();
    if (!proposalMember) {
      throw throwInvalidArgument(WenError.you_are_not_allowed_to_vote_on_this_proposal);
    }
    assertAnswerIsValid(proposal, params.body.values[0]);

    if (proposal.type === ProposalType.NATIVE) {
      return createVoteTransactionOrder(proposal, owner, params.body.values);
    }

    const weight = proposalMember.weight || 0;
    const values = params.body.values;

    const voteTransaction = await createVoteTransaction(proposal, owner, weight, values);

    await proposalMemberDocRef.update(
      uOn({
        voted: true,
        tranId: voteTransaction.uid,
        values: [{ [params.body.values[0]]: weight }],
      }),
    );

    const data = getProposalUpdateDataAfterVote(proposal, proposalMember, weight, values);
    await proposalDocRef.set(uOn(data), { merge: true });

    if (RelatedRecordsResponse.status) {
      return {
        ...voteTransaction,
        ...{ _relatedRecs: { proposal: (await proposalDocRef.get()).data() } },
      };
    } else {
      return voteTransaction;
    }
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

const createVoteTransactionOrder = async (
  proposal: Proposal,
  owner: string,
  voteValues: number[],
) => {
  const network = isProdEnv() ? Network.SMR : Network.RMS;
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const voteOrder: Transaction = {
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: proposal.space,
    network,
    payload: {
      type: TransactionOrderType.PROPOSAL_VOTE,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(getExpiresOn(proposal)),
      validationType: TransactionValidationType.ADDRESS,
      reconciled: false,
      void: false,
      chainReference: null,
      proposalId: proposal.uid,
      voteValues,
    },
    linkedTransactions: [],
  };
  const voteTransactionOrderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${voteOrder.uid}`);
  await voteTransactionOrderDocRef.create(cOn(voteOrder));
  return voteOrder;
};

const getExpiresOn = (proposal: Proposal) => {
  const endDate = dayjs(proposal.settings.endDate.toDate());
  const expiresOn = dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
  if (expiresOn.isAfter(endDate)) {
    return endDate;
  }
  return expiresOn;
};

const createVoteTransaction = async (
  proposal: Proposal,
  owner: string,
  weight: number,
  values: number[],
) => {
  const voteTransaction = <Transaction>{
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
    },
    linkedTransactions: [],
  };

  const voteTransactionDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${voteTransaction.uid}`);
  await voteTransactionDocRef.create(cOn(voteTransaction));
  return voteTransaction;
};

const getProposalUpdateDataAfterVote = (
  proposal: Proposal,
  proposalMember: ProposalMember,
  weight: number,
  values: number[],
) => {
  const prevAnswer = head(Object.keys(head(proposalMember.values) || {}));
  const data = {
    results: {
      voted: inc(proposalMember.voted ? 0 : weight * proposal.questions.length),
      answers: { [`${values[0]}`]: inc(weight) },
    },
  };
  if (prevAnswer) {
    data.results.answers[prevAnswer] = inc(-weight);
  }
  return data;
};
