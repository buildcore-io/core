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

  bid = (auction: string) =>
    new OtrRequest<AuctionBidTangleRequest>(this.otrAddress, {
      requestType: TangleRequestType.BID_AUCTION,
      auction,
    });
}
