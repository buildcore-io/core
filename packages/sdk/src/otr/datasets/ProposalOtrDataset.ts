import {
  ApproveProposalTangleRequest,
  ProposalCreateTangleRequest,
  ProposalVoteTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

export class ProposalOtrDataset extends DatasetClass {
  create = (params: Omit<ProposalCreateTangleRequest, 'requestType'>) =>
    new OtrRequest<ProposalCreateTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.PROPOSAL_CREATE,
    });

  approve = (params: Omit<ApproveProposalTangleRequest, 'requestType'>) =>
    new OtrRequest<ApproveProposalTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.PROPOSAL_APPROVE,
    });

  reject = (params: Omit<ApproveProposalTangleRequest, 'requestType'>) =>
    new OtrRequest<ApproveProposalTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.PROPOSAL_REJECT,
    });

  vote = (params: Omit<ProposalVoteTangleRequest, 'requestType'>) =>
    new OtrRequest<ProposalVoteTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.PROPOSAL_VOTE,
    });
}
