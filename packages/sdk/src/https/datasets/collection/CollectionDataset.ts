import {
  BuildcoreRequest,
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
} from '@buildcore/interfaces';
import { DatasetClass } from '../Dataset';

/**
 * NFT Collection Dataset
 */
export class CollectionDataset<D extends Dataset> extends DatasetClass<D, Collection> {
  /**
   * Create NFT Collection.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link CreateCollectionRequest}
   * @returns
   */
  create = (req: BuildcoreRequest<CreateCollectionRequest>) =>
    this.sendRequest(WEN_FUNC.createCollection)<CreateCollectionRequest, Collection>(req);
  /**
   * Update NFT Collection.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link UpdateCollectionRequest}
   * @returns
   */
  update = (req: BuildcoreRequest<UpdateCollectionRequest>) =>
    this.sendRequest(WEN_FUNC.updateCollection)<UpdateCollectionRequest, Collection>(req);
  /**
   * Update minted NFT Collection. Only certain fields are updated (typically those that are not immutable and stored on DLT)
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link UpdateCollectionRequest}
   * @returns
   */
  updateMinted = (req: BuildcoreRequest<UpdateCollectionRequest>) =>
    this.sendRequest(WEN_FUNC.updateCollection)<UpdateCollectionRequest, Collection>(req);
  /**
   * Reject collection and hide it.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link RejectCollectionRequest}
   * @returns
   */
  reject = (req: BuildcoreRequest<RejectCollectionRequest>) =>
    this.sendRequest(WEN_FUNC.rejectCollection)<RejectCollectionRequest, Collection>(req);
  /**
   * Mint collection on defined network.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link CollectionMintRequest}
   * @returns
   */
  mint = (req: BuildcoreRequest<CollectionMintRequest>) =>
    this.sendRequest(WEN_FUNC.mintCollection)<CollectionMintRequest, Transaction>(req);
  /**
   * Give collection a vote up or down.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link VoteRequest}
   * @returns
   */
  vote = (req: BuildcoreRequest<VoteRequest>) =>
    this.sendRequest(WEN_FUNC.voteController)<VoteRequest, Vote>(req);
  /**
   * Rank collection. This typically is managed by Rank Moderators.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link RankRequest}
   * @returns
   */
  rank = (req: BuildcoreRequest<RankRequest>) =>
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
