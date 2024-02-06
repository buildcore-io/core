import {
  ApproveProposalTangleRequest,
  ProposalCreateTangleRequest,
  ProposalVoteTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

/**
 * Proposal OTR Dataset
 */
export class ProposalOtrDataset extends DatasetClass {
  /**
   * Create Proposal
   *
   * @param params Use {@link OtrRequest} with data based on {@link ProposalCreateTangleRequest}
   * @returns
   */
  create = (params: Omit<ProposalCreateTangleRequest, 'requestType'>) =>
    new OtrRequest<ProposalCreateTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.PROPOSAL_CREATE,
    });
  /**
   * Approve Proposal
   *
   * @param params Use {@link OtrRequest} with data based on {@link ApproveProposalTangleRequest}
   * @returns
   */
  approve = (params: Omit<ApproveProposalTangleRequest, 'requestType'>) =>
    new OtrRequest<ApproveProposalTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.PROPOSAL_APPROVE,
    });
  /**
   * Reject Proposal
   *
   * @param params Use {@link OtrRequest} with data based on {@link ApproveProposalTangleRequest}
   * @returns
   */
  reject = (params: Omit<ApproveProposalTangleRequest, 'requestType'>) =>
    new OtrRequest<ApproveProposalTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.PROPOSAL_REJECT,
    });
  /**
   * Vote Proposal
   *
   * @param params Use {@link OtrRequest} with data based on {@link ProposalVoteTangleRequest}
   * @returns
   */
  vote = (params: Omit<ProposalVoteTangleRequest, 'requestType'>) =>
    new OtrRequest<ProposalVoteTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.PROPOSAL_VOTE,
    });
}
