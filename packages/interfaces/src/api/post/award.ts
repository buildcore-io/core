import { ApiError } from '.';
import { EthAddress, Network, Transaction } from '../../models';

/**
 * Http request to add a new owner to an existing award
 * Endpoint to call: api/addowneraward
 */
export interface AwardAddOwnerRequest {
  /**
   * Build5 id of the award
   */
  uid: EthAddress;
  /**
   * Build5 id or wallet address of the member to be added as guardian
   */
  member: EthAddress;
}

/**
 * Http request to approve the participation of one or more members in the given award
 * Endpoint to call: api/aparticipantaward
 */
export interface AwardApproveParticipantRequest {
  /**
   * Build5 id of the award
   */
  award: EthAddress;
  /**
   * Build5 id or wallet address of the participating member(s) to be approved
   */
  members: EthAddress[];
}

/**
 * Http response object returned after calling api/aparticipantaward
 */
export interface AwardApproveParticipantResponse {
  /**
   * A key value pair where
   * @key Build5 id or wallet address of the participant(s)
   * @value a Transaction object containing transactional value about the received badge
   */
  badges: { [key: string]: Transaction };
  /**
   * A key value pair where
   * @key Build5 id or wallet address of the participant(s)
   * @value the error describing why the participant could not be awarded with the badge
   */
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
