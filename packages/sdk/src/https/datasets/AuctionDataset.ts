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
   * Create generic Auction.
   *
   * @param req Use {@link Build5Request} with data based on {@link AuctionCreateRequest}
   * @returns
   */
  create = (req: Build5Request<AuctionCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createauction)<AuctionCreateRequest, Auction>(req);

  /**
   * Bid on auction.
   *
   * @param req Use {@link Build5Request} with data based on {@link AuctionBidRequest}
   * @returns
   */
  bid = (req: Build5Request<AuctionBidRequest>) =>
    this.sendRequest(WEN_FUNC.bidAuction)<AuctionBidRequest, Transaction>(req);
}
