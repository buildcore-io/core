import {
  COL,
  Proposal,
  ProposalType,
  RelatedRecordsResponse,
  SUB_COL,
  TokenStatus,
  WenError,
} from '@soonaverse/interfaces';
import { Transaction } from 'ethers';
import admin from '../../admin.config';
import { Database } from '../../database/Database';
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
      return await admin
        .firestore()
        .runTransaction(async (transaction) =>
          voteWithStakedTokens(transaction, owner, proposal, values),
        );
    }

    const order = await createVoteTransactionOrder(owner, proposal, values, token);
    await Database.create(COL.TRANSACTION, order);
    return await Database.getById<Transaction>(COL.TRANSACTION, order.uid);
  }

  const voteData = await executeSimpleVoting(proposalMember, proposal, values);
  const batch = Database.createBatchWriter();
  batch.set(COL.PROPOSAL, voteData.proposal, undefined, undefined, true);
  batch.set(COL.PROPOSAL, voteData.proposalMember, SUB_COL.MEMBERS, proposal.uid, true);
  batch.set(COL.TRANSACTION, voteData.voteTransaction);
  await batch.commit();

  const voteTransaction = await Database.getById<Transaction>(
    COL.TRANSACTION,
    voteData.voteTransaction.uid,
  );
  if (RelatedRecordsResponse.status) {
    return {
      ...voteTransaction,
      ...{
        _relatedRecs: { proposal: await Database.getById<Proposal>(COL.PROPOSAL, proposal.uid) },
      },
    };
  } else {
    return voteTransaction;
  }
};
