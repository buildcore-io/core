import {
  Build5Request,
  Dataset,
  GetManyAdvancedRequest,
  MintMetadataNftRequest,
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

/**
 * NFT Dataset.
 */
export class NftDataset<D extends Dataset> extends DatasetClass<D, Nft> {
  /**
   * Create NFT
   *
   * @param req Use {@link Build5Request} with data based on {@link NftCreateRequest}
   * @returns
   */
  create = (req: Build5Request<NftCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createNft)<NftCreateRequest, Nft>(req);
  /**
   * Create batch NFT
   *
   * @param req Use {@link Build5Request} with data based on {@link NftCreateRequest}
   * @returns
   */
  createBatch = (req: Build5Request<NftCreateRequest[]>) =>
    this.sendRequest(WEN_FUNC.createBatchNft)<NftCreateRequest[], Nft[]>(req);
  /**
   * Set NFT for sale
   *
   * @param req Use {@link Build5Request} with data based on {@link NftSetForSaleRequest}
   * @returns
   */
  setForSale = (req: Build5Request<NftSetForSaleRequest>) =>
    this.sendRequest(WEN_FUNC.setForSaleNft)<NftSetForSaleRequest, Nft>(req);
  /**
   * Withdraw NFT
   *
   * @param req Use {@link Build5Request} with data based on {@link NftWithdrawRequest}
   * @returns
   */
  withdraw = (req: Build5Request<NftWithdrawRequest>) =>
    this.sendRequest(WEN_FUNC.withdrawNft)<NftWithdrawRequest, void>(req);
  /**
   * Deposit NFT
   *
   * @param req Use {@link Build5Request} with data based on {@link ProjectDeactivateRequest}
   * @returns
   */
  deposit = (req: Build5Request<NftDepositRequest>) =>
    this.sendRequest(WEN_FUNC.depositNft)<NftDepositRequest, Transaction>(req);
  /**
   * Update unsold NFT.
   *
   * @param req Use {@link Build5Request} with data based on {@link NftUpdateUnsoldRequest}
   * @returns
   */
  updateUnsold = (req: Build5Request<NftUpdateUnsoldRequest>) =>
    this.sendRequest(WEN_FUNC.updateUnsoldNft)<NftUpdateUnsoldRequest, Nft>(req);
  /**
   * Buy NFT.
   *
   * @param req Use {@link Build5Request} with data based on {@link NftPurchaseRequest}
   * @returns
   */
  order = (req: Build5Request<NftPurchaseRequest>) =>
    this.sendRequest(WEN_FUNC.orderNft)<NftPurchaseRequest, Transaction>(req);
  /**
   * Bin on NFT.
   *
   * @param req Use {@link Build5Request} with data based on {@link NftBidRequest}
   * @returns
   */
  openBid = (req: Build5Request<NftBidRequest>) =>
    this.sendRequest(WEN_FUNC.openBid)<NftBidRequest, Transaction>(req);
  /**
   * Bulk purchase of NFTs
   *
   * @param req Use {@link Build5Request} with data based on {@link NftPurchaseBulkRequest}
   * @returns
   */
  bulkPurchase = (req: Build5Request<NftPurchaseBulkRequest>) =>
    this.sendRequest(WEN_FUNC.orderNftBulk)<NftPurchaseBulkRequest, Transaction>(req);
  /**
   * Transfer NFT
   *
   * @param req Use {@link Build5Request} with data based on {@link NftTransferRequest}
   * @returns
   */
  transfer = this.sendRequest(WEN_FUNC.nftTransfer)<NftTransferRequest, { [key: string]: number }>;
  /**
   * Mint metadata NFT
   *
   * @param req Use {@link Build5Request} with data based on {@link MintMetadataNftRequest}
   * @returns
   */
  mintMetadata = this.sendRequest(WEN_FUNC.mintMetadataNft)<MintMetadataNftRequest, Transaction>;

  /**
   * Get all NFTs by collection. Real time stream.
   *
   * @param collection
   * @param orderBy
   * @param orderByDir
   * @param startAfter
   * @returns
   */
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

  /**
   * Get all NFTs by owner. Real time stream.
   * @param owner
   * @param startAfter
   * @returns
   */
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
