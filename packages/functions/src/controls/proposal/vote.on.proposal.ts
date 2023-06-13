import {
  COL,
  Proposal,
  ProposalType,
  RelatedRecordsResponse,
  SUB_COL,
  TokenStatus,
  Transaction,
  WenError,
} from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import {
  getProposal,
  getProposalMember,
} from '../../services/payment/tangle-service/proposal/voting/ProposalVoteService';
import { executeSimpleVoting } from '../../services/payment/tangle-service/proposal/voting/simple.voting';
import { voteWithStakedTokens } from '../../services/payment/tangle-service/proposal/voting/staked.token.voting';
import { createVoteTransactionOrder } from '../../services/payment/tangle-service/proposal/voting/token.voting';
import { invalidArgument } from '../../utils/error.utils';
import { getTokenForSpace } from '../../utils/token.utils';

export const voteOnProposalControl = async (owner: string, params: Record<string, unknown>) => {
  const values = params.values as number[];
  const proposal = await getProposal(params.uid as string);
  const proposalMember = await getProposalMember(owner, proposal, values[0]);

  if (proposal.type === ProposalType.NATIVE) {
    const token = await getTokenForSpace(proposal.space);
    if (token?.status !== TokenStatus.MINTED) {
      throw invalidArgument(WenError.token_not_minted);
    }

    if (params.voteWithStakedTokes) {
      return await build5Db().runTransaction(async (transaction) =>
        voteWithStakedTokens(transaction, owner, proposal, values),
      );
    }

    const order = await createVoteTransactionOrder(owner, proposal, values, token);
    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
    await orderDocRef.create(order);

    return await orderDocRef.get<Transaction>();
  }

  const voteData = await executeSimpleVoting(proposalMember, proposal, values);
  const batch = build5Db().batch();

  const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal.uid}`);
  batch.set(proposalDocRef, voteData.proposal, true);

  const proposalMemberDocRef = proposalDocRef.collection(SUB_COL.MEMBERS).doc(proposalMember.uid);
  batch.set(proposalMemberDocRef, voteData.proposalMember, true);

  const voteTransactionDocRef = build5Db().doc(
    `${COL.TRANSACTION}/${voteData.voteTransaction.uid}`,
  );
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
