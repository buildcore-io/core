import {
  Auction,
  AuctionBidRequest,
  AuctionCreateRequest,
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
  create = this.sendRequest(WEN_FUNC.createauction)<AuctionCreateRequest, Auction>;

  /**
   * Bid on an auction.
   */
  bid = this.sendRequest(WEN_FUNC.bidAuction)<AuctionBidRequest, Transaction>;
}
