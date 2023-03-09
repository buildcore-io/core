import { COL, Proposal, TangleRequestType, WenError } from '@soonaverse/interfaces';
import admin from '../../../../admin.config';
import { Database } from '../../../../database/Database';
import { throwInvalidArgument } from '../../../../utils/error.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { TransactionService } from '../../transaction-service';

export class ProposalApprovalService {
  constructor(readonly transactionService: TransactionService) {}

  public handleProposalApproval = async (owner: string, request: Record<string, unknown>) => {
    const { requestType, ...params } = request;
    const data = await getProposalApprovalData(
      owner,
      params.uid as string,
      requestType === TangleRequestType.PROPOSAL_APPROVE,
    );
    const docRef = admin.firestore().doc(`${COL.PROPOSAL}/${params.uid}`);
    this.transactionService.updates.push({ ref: docRef, data, action: 'update' });

    return { status: 'success' };
  };
}

export const getProposalApprovalData = async (
  owner: string,
  proposalId: string,
  approve: boolean,
) => {
  const proposal = await Database.getById<Proposal>(COL.PROPOSAL, proposalId);
  if (!proposal) {
    throw throwInvalidArgument(WenError.proposal_does_not_exists);
  }

  await assertIsGuardian(proposal.space, owner);

  if (proposal.approved) {
    throw throwInvalidArgument(WenError.proposal_is_already_approved);
  }

  if (proposal.rejected) {
    throw throwInvalidArgument(WenError.proposal_is_already_rejected);
  }

  return approve ? { approved: true, approvedBy: owner } : { rejected: true, rejectedBy: owner };
};
