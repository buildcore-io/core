import {
  Auction,
  AuctionBidRequest,
  AuctionCreateRequest,
  BuildcoreRequest,
  Dataset,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Auction dataset to read and trigger POST actions against the API
 */
export class AuctionDataset<D extends Dataset> extends DatasetClass<D, Auction> {
  /**
   * Create generic Auction.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AuctionCreateRequest}
   * @returns
   */
  create = (req: BuildcoreRequest<AuctionCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createauction)<AuctionCreateRequest, Auction>(req);

  /**
   * Bid on auction.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link AuctionBidRequest}
   * @returns
   */
  bid = (req: BuildcoreRequest<AuctionBidRequest>) =>
    this.sendRequest(WEN_FUNC.bidAuction)<AuctionBidRequest, Transaction>(req);
}
