import {
  Build5Request,
  Dataset,
  GetManyAdvancedRequest,
  Nft,
  NftBidRequest,
  NftCreateRequest,
  NftDepositRequest,
  NftPurchaseBulkRequest,
  NftPurchaseRequest,
  NftSetForSaleRequest,
  NftUpdateUnsoldRequest,
  NftWithdrawRequest,
  Opr,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class NftDataset<D extends Dataset> extends DatasetClass<D, Nft> {
  create = (req: Build5Request<NftCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createNft)<NftCreateRequest, Nft>(req);

  createBatch = (req: Build5Request<NftCreateRequest[]>) =>
    this.sendRequest(WEN_FUNC.createBatchNft)<NftCreateRequest[], Nft[]>(req);

  setForSale = (req: Build5Request<NftSetForSaleRequest>) =>
    this.sendRequest(WEN_FUNC.setForSaleNft)<NftSetForSaleRequest, Nft>(req);

  withdraw = (req: Build5Request<NftWithdrawRequest>) =>
    this.sendRequest(WEN_FUNC.withdrawNft)<NftWithdrawRequest, void>(req);

  deposit = (req: Build5Request<NftDepositRequest>) =>
    this.sendRequest(WEN_FUNC.depositNft)<NftDepositRequest, Transaction>(req);

  updateUnsold = (req: Build5Request<NftUpdateUnsoldRequest>) =>
    this.sendRequest(WEN_FUNC.updateUnsoldNft)<NftUpdateUnsoldRequest, Nft>(req);

  order = (req: Build5Request<NftPurchaseRequest>) =>
    this.sendRequest(WEN_FUNC.orderNft)<NftPurchaseRequest, Transaction>(req);

  openBid = (req: Build5Request<NftBidRequest>) =>
    this.sendRequest(WEN_FUNC.openBid)<NftBidRequest, Transaction>(req);

  bulkPurchase = (req: Build5Request<NftPurchaseBulkRequest>) =>
    this.sendRequest(WEN_FUNC.orderNftBulk)<NftPurchaseBulkRequest, Transaction>(req);

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
