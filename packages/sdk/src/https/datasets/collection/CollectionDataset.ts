import {
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
  create = this.sendRequest(WEN_FUNC.createCollection)<CreateCollectionRequest, Collection>;
  /**
   * Update NFT Collection.
   */
  update = this.sendRequest(WEN_FUNC.updateCollection)<UpdateCollectionRequest, Collection>;
  /**
   * Update minted NFT Collection. Only certain fields are updated (typically those that are not immutable and stored on DLT)
   */
  updateMinted = this.sendRequest(WEN_FUNC.updateCollection)<UpdateCollectionRequest, Collection>;
  /**
   * Reject collection and hide it.
   */
  reject = this.sendRequest(WEN_FUNC.rejectCollection)<RejectCollectionRequest, Collection>;
  /**
   * Mint collection on defined network.
   */
  mint = this.sendRequest(WEN_FUNC.mintCollection)<CollectionMintRequest, Transaction>;
  /**
   * Give collection a vote up or down.
   */
  vote = this.sendRequest(WEN_FUNC.voteController)<VoteRequest, Vote>;
  /**
   * Rank collection. This typically is managed by Rank Moderators.
   */
  rank = this.sendRequest(WEN_FUNC.rankController)<RankRequest, Rank>;
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
