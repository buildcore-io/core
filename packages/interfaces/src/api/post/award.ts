import { ApiError } from '.';
import { EthAddress, Network, Transaction } from '../../models';

export interface AwardAddOwnerRequest {
  uid: EthAddress;
  member: EthAddress;
}

export interface AwardApproveParticipantRequest {
  award: EthAddress;
  members: EthAddress[];
}

export interface AwardApproveParticipantResponse {
  badges: { [key: string]: Transaction };
  errors: { [key: string]: ApiError };
}

export interface AwardCancelRequest {
  uid: EthAddress;
}

export interface AwardCreateBadgeRequest {
  name: string;
  description?: string | null;
  total: number;
  image: string;
  tokenReward: number;
  tokenSymbol: string;
  lockTime: number;
}

export interface AwardCreateRequest {
  name: string;
  description?: string | null;
  space: EthAddress;
  endDate: Date;
  badge: AwardCreateBadgeRequest;
  network: Network;
}

export interface AwardFundRequest {
  uid: EthAddress;
}

export interface AwardParticpateRequest {
  uid: EthAddress;
  comment?: string;
}

export interface AwardRejectRequest {
  uid: EthAddress;
}
