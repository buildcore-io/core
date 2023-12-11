import {
  AuctionBidTangleRequest,
  AuctionCreateTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import { DatasetClass, OtrRequest } from './common';

export class AuctionOtrDataset extends DatasetClass {
  create = (params: Omit<AuctionCreateTangleRequest, 'requestType'>) =>
    new OtrRequest<AuctionCreateTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.CREATE_AUCTION,
    });

  bid = (params: Omit<AuctionBidTangleRequest, 'requestType'>) =>
    new OtrRequest<AuctionBidTangleRequest>(this.otrAddress, {
      ...params,
      requestType: TangleRequestType.BID_AUCTION,
    });
}
