import { EthAddress } from '../../models';
import { ApproveProposalRequest, ProposalCreateRequest, ProposalVoteRequest } from '../post';

export type ApproveProposalTangleRequest = ApproveProposalRequest;

export type ProposalVoteTangleRequest = ProposalVoteRequest;

export interface ProposalVoteTangleResponse {
  readonly status?: string;
  voteTransaction?: EthAddress;
}

export type ProposalCreateTangleRequest = ProposalCreateRequest;

export interface ProposalCreateTangleResponse {
  proposal: EthAddress;
}
