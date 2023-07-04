import { EthAddress, Network, NftAccess, StakeType } from '../../models';

export interface NftBidRequest {
  nft: EthAddress;
}

export interface NftCreateRequest {
  name?: string | null;
  description?: string | null;
  collection: EthAddress;
  media?: URL;
  availableFrom: Date;
  price: number;
  url?: URL;
  properties?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  saleAccessMembers?: string[];
}

export type NftBatchCreateRequest = NftCreateRequest[];

export interface NftDepositRequest {
  network: Network;
}

export interface NftPurchaseRequest {
  collection: EthAddress;
  nft?: EthAddress;
}

export interface NftSetForSaleRequest {
  nft: EthAddress;
  price: number;
  availableFrom: Date;
  auctionFrom: Date;
  auctionFloorPrice: number;
  auctionLength: number;
  access: NftAccess.OPEN | NftAccess.MEMBERS;
  accessMembers?: EthAddress[];
}

export interface NftStakeRequest {
  network: Network;
  weeks: number;
  type: StakeType;
}

export interface NftUpdateUnsoldRequest {
  uid: EthAddress;
  price: number;
}

export interface NftWithdrawRequest {
  nft: EthAddress;
}
