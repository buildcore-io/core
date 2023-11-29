import {
  Dataset,
  GetManyAdvancedRequest,
  Nft,
  NftBidRequest,
  NftCreateRequest,
  NftDepositRequest,
  NftPurchaseRequest,
  NftSetForSaleRequest,
  NftUpdateUnsoldRequest,
  NftWithdrawRequest,
  Opr,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class NftDataset<D extends Dataset> extends DatasetClass<D, Nft> {
  create = this.sendRequest(WEN_FUNC.createNft)<NftCreateRequest>;

  createBatch = this.sendRequest(WEN_FUNC.createBatchNft)<NftCreateRequest[]>;

  setForSale = this.sendRequest(WEN_FUNC.setForSaleNft)<NftSetForSaleRequest>;

  withdraw = this.sendRequest(WEN_FUNC.withdrawNft)<NftWithdrawRequest>;

  deposit = this.sendRequest(WEN_FUNC.depositNft)<NftDepositRequest>;

  updateUnsold = this.sendRequest(WEN_FUNC.updateUnsoldNft)<NftUpdateUnsoldRequest>;

  order = this.sendRequest(WEN_FUNC.orderNft)<NftPurchaseRequest>;

  openBid = this.sendRequest(WEN_FUNC.openBid)<NftBidRequest>;

  getByCollectionLive = (
    collection: string,
    orderBy: string[],
    orderByDir: string[],
    startAfter?: string,
  ) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['hidden', 'collection'],
      fieldValue: [false, collection],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy,
      orderByDir,
    };
    return this.getManyAdvancedLive(params);
  };

  getByOwnerLive = (owner: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['hidden', 'owner'],
      fieldValue: [false, owner],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['updatedOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
