import { EthAddress, ProposalQuestion, ProposalSettings, ProposalType } from '../../models';

export interface ProposalCreateRequest {
  name: string;
  space: EthAddress;
  additionalInfo?: string;
  type: ProposalType.MEMBERS | ProposalType.NATIVE;
  settings: ProposalSettings;
  questions: ProposalQuestion[];
}

export interface ApproveProposalRequest {
  uid: EthAddress;
}

export interface RejectProposalRequest {
  uid: EthAddress;
}

export interface ProposalVoteRequest {
  uid: EthAddress;
  value: number;
  voteWithStakedTokes: boolean;
}
