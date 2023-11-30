import {
  Auction,
  AuctionBidRequest,
  AuctionCreateRequest,
  Dataset,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class AuctionDataset<D extends Dataset> extends DatasetClass<D, Auction> {
  create = this.sendRequest(WEN_FUNC.createauction)<AuctionCreateRequest, Auction>;

  bid = this.sendRequest(WEN_FUNC.bidAuction)<AuctionBidRequest, Transaction>;
}
