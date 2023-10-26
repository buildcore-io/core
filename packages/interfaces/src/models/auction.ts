import { BaseRecord, Timestamp } from './base';
import { Network } from './transaction';

export interface AuctionBid {
  amount: number;
  bidder: string;
  order: string;
}

export enum AuctionType {
  OPEN = 'OPEN',
  NFT = 'NFT',
}

export interface Auction extends BaseRecord {
  auctionFrom: Timestamp;
  auctionTo: Timestamp;
  auctionLength: number;

  extendedAuctionTo?: Timestamp | null;
  extendedAuctionLength?: number | null;
  extendAuctionWithin?: number | null;

  auctionFloorPrice: number;

  bids: AuctionBid[];
  auctionHighestBidder?: string;
  auctionHighestBid?: number;
  maxBids: number;

  type: AuctionType;
  network: Network;
  nftId?: string;

  active: boolean;
  topUpBased?: boolean;
}
