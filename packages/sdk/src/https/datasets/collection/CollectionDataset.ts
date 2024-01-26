import {
  Build5Request,
  Collection,
  CollectionMintRequest,
  CreateCollectionRequest,
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  Rank,
  RankRequest,
  RejectCollectionRequest,
  Transaction,
  UpdateCollectionRequest,
  Vote,
  VoteRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from '../Dataset';

/**
 * NFT Collection Dataset
 */
export class CollectionDataset<D extends Dataset> extends DatasetClass<D, Collection> {
  /**
   * Create NFT Collection.
   */
  create = (req: Build5Request<CreateCollectionRequest>) =>
    this.sendRequest(WEN_FUNC.createCollection)<CreateCollectionRequest, Collection>(req);
  /**
   * Update NFT Collection.
   */
  update = (req: Build5Request<UpdateCollectionRequest>) =>
    this.sendRequest(WEN_FUNC.updateCollection)<UpdateCollectionRequest, Collection>(req);
  /**
   * Update minted NFT Collection. Only certain fields are updated (typically those that are not immutable and stored on DLT)
   */
  updateMinted = (req: Build5Request<UpdateCollectionRequest>) =>
    this.sendRequest(WEN_FUNC.updateCollection)<UpdateCollectionRequest, Collection>(req);
  /**
   * Reject collection and hide it.
   */
  reject = (req: Build5Request<RejectCollectionRequest>) =>
    this.sendRequest(WEN_FUNC.rejectCollection)<RejectCollectionRequest, Collection>(req);
  /**
   * Mint collection on defined network.
   */
  mint = (req: Build5Request<CollectionMintRequest>) =>
    this.sendRequest(WEN_FUNC.mintCollection)<CollectionMintRequest, Transaction>(req);
  /**
   * Give collection a vote up or down.
   */
  vote = (req: Build5Request<VoteRequest>) =>
    this.sendRequest(WEN_FUNC.voteController)<VoteRequest, Vote>(req);
  /**
   * Rank collection. This typically is managed by Rank Moderators.
   */
  rank = (req: Build5Request<RankRequest>) =>
    this.sendRequest(WEN_FUNC.rankController)<RankRequest, Rank>(req);
  /**
   * Get all pending collections per space. Real time stream.
   *
   * @param space
   * @param startAfter
   * @returns
   */
  getAllPendingLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'approved', 'rejected'],
      fieldValue: [space, false, false],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
  /**
   * Get all available collections per space. Real time stream.
   *
   * @param space
   * @param startAfter
   * @returns
   */
  getAllAvailableLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'approved'],
      fieldValue: [space, true],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
  /**
   * Get all rejected collections per space. Real time stream.
   *
   * @param space
   * @param startAfter
   * @returns
   */
  getAllRejectedLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space', 'rejected'],
      fieldValue: [space, true],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
