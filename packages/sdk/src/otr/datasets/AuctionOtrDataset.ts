import {
  AuctionBidTangleRequest,
  AuctionCreateTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

/**
 * Auction OTR Dataset
 */
export class AuctionOtrDataset extends DatasetClass {
  /**
   * Create Auction.
   *
   * @param params Use {@link OtrRequest} with data based on {@link AuctionCreateTangleRequest}
   * @returns
   */
  create = (params: Omit<AuctionCreateTangleRequest, 'requestType'>) =>
    new OtrRequest<AuctionCreateTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.CREATE_AUCTION,
    });
  /**
   * Bid on Auction.
   *
   * @param params Use {@link OtrRequest} with data based on {@link AuctionBidTangleRequest}
   * @returns
   */
  bid = (params: Omit<AuctionBidTangleRequest, 'requestType'>) =>
    new OtrRequest<AuctionBidTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.BID_AUCTION,
    });
}
