import {
  COL,
  Proposal,
  ProposalType,
  RelatedRecordsResponse,
  SUB_COL,
  TokenStatus,
  Transaction,
  WenError,
} from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import {
  getProposal,
  getProposalMember,
} from '../../services/payment/tangle-service/proposal/voting/ProposalVoteService';
import { executeSimpleVoting } from '../../services/payment/tangle-service/proposal/voting/simple.voting';
import { voteWithStakedTokens } from '../../services/payment/tangle-service/proposal/voting/staked.token.voting';
import { createVoteTransactionOrder } from '../../services/payment/tangle-service/proposal/voting/token.voting';
import { throwInvalidArgument } from '../../utils/error.utils';
import { getTokenForSpace } from '../../utils/token.utils';

export const voteOnProposalControl = async (owner: string, params: Record<string, unknown>) => {
  const values = params.values as number[];
  const proposal = await getProposal(params.uid as string);
  const proposalMember = await getProposalMember(owner, proposal, values[0]);

  if (proposal.type === ProposalType.NATIVE) {
    const token = await getTokenForSpace(proposal.space);
    if (token?.status !== TokenStatus.MINTED) {
      throw throwInvalidArgument(WenError.token_not_minted);
    }

    if (params.voteWithStakedTokes) {
      return await soonDb().runTransaction(async (transaction) =>
        voteWithStakedTokens(transaction, owner, proposal, values),
      );
    }

    const order = await createVoteTransactionOrder(owner, proposal, values, token);
    const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
    await orderDocRef.create(order);

    return await orderDocRef.get<Transaction>();
  }

  const voteData = await executeSimpleVoting(proposalMember, proposal, values);
  const batch = soonDb().batch();

  const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  batch.set(proposalDocRef, voteData.proposal, true);

  const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(proposalMember.uid);
  batch.set(proposalMemberDocRef, voteData.proposalMember, true);

  const voteTransactionDocRef = soonDb().doc(`${COL.TRANSACTION}/${voteData.voteTransaction.uid}`);
  batch.create(voteTransactionDocRef, voteData.voteTransaction);
  await batch.commit();

  const voteTransaction = await voteTransactionDocRef.get<Transaction>();
  if (RelatedRecordsResponse.status) {
    return {
      ...voteTransaction,
      ...{
        _relatedRecs: { proposal: await proposalDocRef.get<Proposal>() },
      },
    };
  } else {
    return voteTransaction;
  }
};
