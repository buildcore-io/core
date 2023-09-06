import { build5Db } from '@build-5/database';
import {
  BaseTangleResponse,
  COL,
  Proposal,
  TangleRequestType,
  WenError,
} from '@build-5/interfaces';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { TransactionService } from '../../transaction-service';
import { proposalApproveSchema } from './ProposalApproveTangleRequestSchema';

export class ProposalApprovalService {
  constructor(readonly transactionService: TransactionService) {}

  public handleProposalApproval = async (
    owner: string,
    request: Record<string, unknown>,
  ): Promise<BaseTangleResponse> => {
    const params = await assertValidationAsync(proposalApproveSchema, request);
    const data = await getProposalApprovalData(
      owner,
      params.uid,
      params.requestType === TangleRequestType.PROPOSAL_APPROVE,
    );
    const docRef = build5Db().doc(`${COL.PROPOSAL}/${params.uid}`);
    this.transactionService.push({ ref: docRef, data, action: 'update' });

    return { status: 'success' };
  };
}

export const getProposalApprovalData = async (
  owner: string,
  proposalId: string,
  approve: boolean,
) => {
  const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposalId}`);
  const proposal = await proposalDocRef.get<Proposal>();
  if (!proposal) {
    throw invalidArgument(WenError.proposal_does_not_exists);
  }

  await assertIsGuardian(proposal.space, owner);

  if (proposal.approved) {
    throw invalidArgument(WenError.proposal_is_already_approved);
  }

  if (proposal.rejected) {
    throw invalidArgument(WenError.proposal_is_already_rejected);
  }

  return approve ? { approved: true, approvedBy: owner } : { rejected: true, rejectedBy: owner };
};
