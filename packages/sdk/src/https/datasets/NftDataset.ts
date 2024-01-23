import {
  Dataset,
  GetManyAdvancedRequest,
  Nft,
  NftBidRequest,
  NftCreateRequest,
  NftDepositRequest,
  NftPurchaseBulkRequest,
  NftPurchaseRequest,
  NftSetForSaleRequest,
  NftTransferRequest,
  NftUpdateUnsoldRequest,
  NftWithdrawRequest,
  Opr,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class NftDataset<D extends Dataset> extends DatasetClass<D, Nft> {
  create = this.sendRequest(WEN_FUNC.createNft)<NftCreateRequest, Nft>;

  createBatch = this.sendRequest(WEN_FUNC.createBatchNft)<NftCreateRequest[], Nft[]>;

  setForSale = this.sendRequest(WEN_FUNC.setForSaleNft)<NftSetForSaleRequest, Nft>;

  withdraw = this.sendRequest(WEN_FUNC.withdrawNft)<NftWithdrawRequest, void>;

  deposit = this.sendRequest(WEN_FUNC.depositNft)<NftDepositRequest, Transaction>;

  updateUnsold = this.sendRequest(WEN_FUNC.updateUnsoldNft)<NftUpdateUnsoldRequest, Nft>;

  order = this.sendRequest(WEN_FUNC.orderNft)<NftPurchaseRequest, Transaction>;

  openBid = this.sendRequest(WEN_FUNC.openBid)<NftBidRequest, Transaction>;

  bulkPurchase = this.sendRequest(WEN_FUNC.orderNftBulk)<NftPurchaseBulkRequest, Transaction>;

  transfer = this.sendRequest(WEN_FUNC.nftTransfer)<NftTransferRequest, { [key: string]: number }>;

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
