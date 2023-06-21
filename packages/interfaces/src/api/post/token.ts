import { Access, EthAddress, Network, TokenAllocation, TokenTradeOrderType } from '../../models';

export interface TokenCreateRequest {
  name: string;
  symbol: string;
  title?: string;
  description?: string;
  shortDescriptionTitle?: string;
  shortDescription?: string;
  space: string;
  pricePerToken?: number;
  totalSupply: number;
  allocations: TokenAllocation[];
  saleStartDate?: Date;
  saleLength?: number;
  coolDownLength?: number;
  autoProcessAt100Percent?: boolean;
  links: string[];
  icon: string;
  overviewGraphics: string;
  termsAndConditions: string;
  access: Access;
  accessAwards?: EthAddress[];
  accessCollections?: EthAddress[];
  tradingDisabled?: boolean;
  decimals: number;
}

export interface MintedTokenUpdateRequest {
  uid: EthAddress;
  title?: string | null;
  description?: string | null;
  shortDescriptionTitle?: string | null;
  shortDescription?: string | null;
  links: string[];
  pricePerToken: number;
}

export interface SetTokenForSaleRequest {
  token: EthAddress;
  saleStartDate: Date;
  saleLength: number;
  coolDownLength: number;
  autoProcessAt100Percent?: boolean;
  pricePerToken: number;
}

interface TokenId {
  token: EthAddress;
}
export type CanelPublicSaleRequest = TokenId;
export type OrderTokenRequest = TokenId;
export interface EnableTokenTradingRequest {
  uid: EthAddress;
}

export interface CreditTokenRequest {
  token: EthAddress;
  amount: number;
}

export interface TokenUpdateRequest extends MintedTokenUpdateRequest {
  name?: string | null;
}

export interface ImportMintedTokenRequest {
  tokenId: EthAddress;
  space: EthAddress;
  network: Network;
}

export interface TokenMintRequest {
  token: EthAddress;
  network: Network;
}

export interface ClaimAirdroppedTokensRequest {
  symbol: string;
}

export interface ClaimPreMintedAirdroppedTokensRequest {
  token: string;
}

export interface TradeTokenRequest {
  symbol: string;
  count: number;
  price: number;
  type: TokenTradeOrderType;
}

export interface CancelTokenTradeOrderRequest {
  uid: EthAddress;
}
