import { Auction, AuctionBid, AuctionType, Network } from '@build-5/interfaces';
import { Converter } from '../../interfaces/common';
import { PgAuction } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class AuctionConverter implements Converter<Auction, PgAuction> {
  toPg = (auction: Auction): PgAuction => ({
    uid: auction.uid,
    project: auction.project,
    createdOn: auction.createdOn?.toDate(),
    updatedOn: auction.updatedOn?.toDate(),
    createdBy: auction.createdBy,
    space: auction.space,
    auctionFrom: auction.auctionFrom?.toDate(),
    auctionTo: auction.auctionTo?.toDate(),
    auctionLength: auction.auctionLength,
    extendedAuctionTo: auction.extendedAuctionTo?.toDate(),
    extendedAuctionLength: auction.extendedAuctionLength || undefined,
    extendAuctionWithin: auction.extendAuctionWithin || undefined,
    auctionFloorPrice: auction.auctionFloorPrice,
    minimalBidIncrement: auction.minimalBidIncrement,
    auctionHighestBidder: auction.auctionHighestBidder,
    auctionHighestBid: auction.auctionHighestBid,
    maxBids: auction.maxBids,
    type: auction.type,
    network: auction.network,
    nftId: auction.nftId,
    targetAddress: auction.targetAddress,
    active: auction.active,
    topUpBased: auction.topUpBased,
    bids: JSON.stringify(auction.bids) as any,
  });

  fromPg = (pg: PgAuction): Auction =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      space: pg.space!,
      auctionFrom: pgDateToTimestamp(pg.auctionFrom)!,
      auctionTo: pgDateToTimestamp(pg.auctionTo)!,
      auctionLength: pg.auctionLength || 0,
      extendedAuctionTo: pgDateToTimestamp(pg.extendedAuctionTo),
      extendedAuctionLength: pg.extendedAuctionLength,
      extendAuctionWithin: pg.extendAuctionWithin,
      auctionFloorPrice: pg.auctionFloorPrice || 0,
      minimalBidIncrement: pg.minimalBidIncrement || 0,
      bids: pg.bids as unknown as AuctionBid[],
      auctionHighestBidder: pg.auctionHighestBidder,
      auctionHighestBid: pg.auctionHighestBid,
      maxBids: pg.maxBids || 0,
      type: pg.type as AuctionType,
      network: pg.network as Network,
      nftId: pg.nftId,
      targetAddress: pg.targetAddress,
      active: pg.active || false,
      topUpBased: pg.topUpBased,
    });
}
