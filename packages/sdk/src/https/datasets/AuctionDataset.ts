import {
  Auction,
  AuctionBidRequest,
  AuctionCreateRequest,
  Build5Request,
  Dataset,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Auction dataset to read and trigger POST actions against the API
 */
export class AuctionDataset<D extends Dataset> extends DatasetClass<D, Auction> {
  /**
   * Create generic auction.
   */
  create = (req: Build5Request<AuctionCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createauction)<AuctionCreateRequest, Auction>(req);

  /**
   * Bid on an auction.
   */
  bid = (req: Build5Request<AuctionBidRequest>) =>
    this.sendRequest(WEN_FUNC.bidAuction)<AuctionBidRequest, Transaction>(req);
}
