import {
  COL,
  DEFAULT_NETWORK,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  PROPOSAL_COMMENCING_IN_DAYS,
  Proposal,
  ProposalMember,
  ProposalType,
  SUB_COL,
  Token,
  TokenStatus,
  Transaction,
  TransactionType,
  TransactionUnlockType,
  VoteTransaction,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../../../../firebase/firestore/soondb';
import { voteOnProposalSchema } from '../../../../../runtime/firebase/proposal';
import { invalidArgument } from '../../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../../utils/schema.utils';
import { getTokenForSpace } from '../../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../../utils/wallet.utils';
import { TransactionService } from '../../../transaction-service';
import { executeSimpleVoting } from './simple.voting';
import { voteWithStakedTokens } from './staked.token.voting';
import { createVoteTransactionOrder } from './token.voting';

export class ProposalVoteService {
  constructor(readonly transactionService: TransactionService) {}

  public handleVoteOnProposal = async (
    owner: string,
    request: Record<string, unknown>,
    milestoneTran: MilestoneTransaction,
    milestoneTranEntry: MilestoneTransactionEntry,
  ) => {
    delete request.requestType;
    await assertValidationAsync(voteOnProposalSchema, request);

    const values = request.values as number[];
    const proposal = await getProposal(request.uid as string);
    const proposalMember = await getProposalMember(owner, proposal, values[0]);

    if (proposal.type === ProposalType.NATIVE) {
      const token = await getTokenForSpace(proposal.space);
      if (token?.status !== TokenStatus.MINTED) {
        throw invalidArgument(WenError.token_not_minted);
      }

      if (request.voteWithStakedTokes) {
        const voteTransaction = await voteWithStakedTokens(
          this.transactionService.transaction,
          owner,
          proposal,
          values,
        );
        return { status: 'success', voteTransaction: voteTransaction.uid };
      }

      await this.handleTokenVoteRequest(
        owner,
        proposal,
        values,
        token,
        milestoneTran,
        milestoneTranEntry,
      );
      return;
    }

    return await this.handleSimpleVoteRequest(proposal, proposalMember, values);
  };

  private handleTokenVoteRequest = async (
    owner: string,
    proposal: Proposal,
    values: number[],
    token: Token,
    milestoneTran: MilestoneTransaction,
    milestoneTranEntry: MilestoneTransactionEntry,
  ) => {
    const order = await createVoteTransactionOrder(owner, proposal, values, token);
    const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);

    this.transactionService.push({
      ref: orderDocRef,
      data: order,
      action: 'set',
    });

    this.transactionService.createUnlockTransaction(
      order,
      milestoneTran,
      milestoneTranEntry,
      TransactionUnlockType.TANGLE_TRANSFER,
      milestoneTranEntry.outputId,
    );
  };

  private handleSimpleVoteRequest = async (
    proposal: Proposal,
    proposalMember: ProposalMember,
    values: number[],
  ) => {
    const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(proposalMember.uid);

    const voteData = await executeSimpleVoting(proposalMember, proposal, values);

    this.transactionService.push({
      ref: proposalDocRef,
      data: voteData.proposal,
      action: 'set',
      merge: true,
    });

    this.transactionService.push({
      ref: proposalMemberDocRef,
      data: voteData.proposalMember,
      action: 'set',
      merge: true,
    });

    const voteTransactionDocRef = soonDb().doc(
      `${COL.TRANSACTION}/${voteData.voteTransaction.uid}`,
    );
    this.transactionService.push({
      ref: voteTransactionDocRef,
      data: voteData.voteTransaction,
      action: 'set',
    });

    return { status: 'success' };
  };
}

export const getProposal = async (proposalUid: string) => {
  const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposalUid}`);
  const proposal = await proposalDocRef.get<Proposal>();
  if (!proposal) {
    throw invalidArgument(WenError.proposal_does_not_exists);
  }

  if (proposal.rejected) {
    throw invalidArgument(WenError.proposal_is_rejected);
  }

  if (!proposal.approved) {
    throw invalidArgument(WenError.proposal_is_not_approved);
  }
  const isNativeProposal = proposal.type === ProposalType.NATIVE;
  const startDate = dayjs(proposal.settings.startDate.toDate()).subtract(
    isNativeProposal ? PROPOSAL_COMMENCING_IN_DAYS : 0,
    'd',
  );
  const endDate = dayjs(proposal.settings.endDate.toDate());
  if (dayjs().isBefore(startDate) || dayjs().isAfter(endDate)) {
    throw invalidArgument(WenError.vote_is_no_longer_active);
  }

  if (endDate.isBefore(startDate)) {
    throw invalidArgument(WenError.proposal_start_date_must_be_before_end_date);
  }

  return proposal;
};

export const getProposalMember = async (owner: string, proposal: Proposal, value: number) => {
  const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(owner);
  const proposalMember = await proposalMemberDocRef.get<ProposalMember>();
  if (!proposalMember) {
    throw invalidArgument(WenError.you_are_not_allowed_to_vote_on_this_proposal);
  }
  assertAnswerIsValid(proposal, value);

  return proposalMember;
};

const assertAnswerIsValid = (proposal: Proposal, answerSent: number) => {
  for (const question of proposal.questions) {
    for (const answer of question.answers) {
      if (answer.value === answerSent) {
        return;
      }
    }
  }
  throw invalidArgument(WenError.value_does_not_exists_in_proposal);
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
