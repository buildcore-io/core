import { database } from '@buildcore/database';
import {
  COL,
  ProposalType,
  ProposalVoteRequest,
  SUB_COL,
  TokenStatus,
  Transaction,
  WenError,
} from '@buildcore/interfaces';
import {
  getProposal,
  getProposalMember,
} from '../../services/payment/tangle-service/proposal/voting/ProposalVoteService';
import { executeSimpleVoting } from '../../services/payment/tangle-service/proposal/voting/simple.voting';
import { voteWithStakedTokens } from '../../services/payment/tangle-service/proposal/voting/staked.token.voting';
import { createVoteTransactionOrder } from '../../services/payment/tangle-service/proposal/voting/token.voting';
import { invalidArgument } from '../../utils/error.utils';
import { getTokenForSpace } from '../../utils/token.utils';
import { Context } from '../common';

export const voteOnProposalControl = async ({
  owner,
  params,
  project,
}: Context<ProposalVoteRequest>): Promise<Transaction> => {
  const proposal = await getProposal(params.uid);
  const proposalMember = await getProposalMember(owner, proposal, params.value);

  if (proposal.type === ProposalType.NATIVE) {
    const token = await getTokenForSpace(proposal.space);
    if (token?.status !== TokenStatus.MINTED) {
      throw invalidArgument(WenError.token_not_minted);
    }

    if (params.voteWithStakedTokes) {
      const voteTransaction = await database().runTransaction((transaction) =>
        voteWithStakedTokens(project, transaction, owner, proposal, [params.value]),
      );
      return voteTransaction;
    }

    const order = await createVoteTransactionOrder(project, owner, proposal, [params.value], token);
    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    await orderDocRef.create(order);

    return (await orderDocRef.get())!;
  }

  const voteData = executeSimpleVoting(project, proposalMember, proposal, [params.value]);
  const batch = database().batch();

  if (voteData.proposal) {
    const proposalDocRef = database().doc(COL.PROPOSAL, proposal.uid);
    batch.update(proposalDocRef, voteData.proposal);
  }

  const proposalMemberDocRef = database().doc(
    COL.PROPOSAL,
    proposal.uid,
    SUB_COL.MEMBERS,
    proposalMember.uid,
  );
  batch.update(proposalMemberDocRef, voteData.proposalMember);

  const voteTransactionDocRef = database().doc(COL.TRANSACTION, voteData.voteTransaction.uid);
  batch.create(voteTransactionDocRef, voteData.voteTransaction);

  await batch.commit();

  const voteTransaction = await voteTransactionDocRef.get();
  return voteTransaction!;
};
