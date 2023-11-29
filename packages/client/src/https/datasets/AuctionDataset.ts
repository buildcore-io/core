import {
  Auction,
  AuctionBidRequest,
  AuctionCreateRequest,
  Dataset,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class AuctionDataset<D extends Dataset> extends DatasetClass<D, Auction> {
  create = this.sendRequest(WEN_FUNC.createauction)<AuctionCreateRequest>;

  bid = this.sendRequest(WEN_FUNC.bidAuction)<AuctionBidRequest>;
}
