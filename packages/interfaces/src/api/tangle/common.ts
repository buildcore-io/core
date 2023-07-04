import { EthAddress, NativeToken } from '../../models';

export enum TangleRequestType {
  ADDRESS_VALIDATION = 'ADDRESS_VALIDATION',
  SELL_TOKEN = 'SELL_TOKEN',
  BUY_TOKEN = 'BUY_TOKEN',
  STAKE = 'STAKE',
  NFT_PURCHASE = 'NFT_PURCHASE',
  CLAIM_MINTED_AIRDROPS = 'CLAIM_MINTED_AIRDROPS',

  AWARD_CREATE = 'AWARD_CREATE',
  AWARD_FUND = 'AWARD_FUND',
  AWARD_APPROVE_PARTICIPANT = 'AWARD_APPROVE_PARTICIPANT',

  PROPOSAL_CREATE = 'PROPOSAL_CREATE',
  PROPOSAL_APPROVE = 'PROPOSAL_APPROVE',
  PROPOSAL_REJECT = 'PROPOSAL_REJECT',
  PROPOSAL_VOTE = 'PROPOSAL_VOTE',

  SPACE_CREATE = 'SPACE_CREATE',
  SPACE_JOIN = 'SPACE_JOIN',
  SPACE_ADD_GUARDIAN = 'SPACE_ADD_GUARDIAN',
  SPACE_REMOVE_GUARDIAN = 'SPACE_REMOVE_GUARDIAN',
  SPACE_ACCEPT_MEMBER = 'SPACE_ACCEPT_MEMBER',
  SPACE_BLOCK_MEMBER = 'SPACE_BLOCK_MEMBER',
  SPACE_DECLINE_MEMBER = 'SPACE_DECLINE_MEMBER',
  SPACE_LEAVE = 'SPACE_LEAVE',

  MINT_METADATA_NFT = 'MINT_METADATA_NFT',
}

export interface BaseTangleRequest {
  readonly requestType: TangleRequestType;
}

export interface BaseTangleResponse {
  readonly status?: string;
  readonly amount?: number;
  readonly address?: EthAddress;
  readonly code?: number;
  readonly message?: string;
  readonly nativeTokens?: NativeToken[];
}
