/**
 * This file was automatically generated by knex
 * Do not modify this file manually
 */
import * as commons from './common';

export interface PgAuction extends commons.BaseRecord {
  space?: string;
  auctionFrom?: Date;
  auctionTo?: Date;
  auctionLength?: number;
  extendedAuctionTo?: Date;
  extendedAuctionLength?: number;
  extendAuctionWithin?: number;
  auctionFloorPrice?: number;
  minimalBidIncrement?: number;
  auctionHighestBidder?: string;
  auctionHighestBid?: number;
  maxBids?: number;
  type?: string;
  network?: string;
  nftId?: string;
  targetAddress?: string;
  active?: boolean;
  topUpBased?: boolean;
  bids?: Record<string, unknown>[];
}