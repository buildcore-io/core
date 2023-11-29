import {
  Collection,
  CollectionMintRequest,
  CreateCollectionRequest,
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  RankRequest,
  RejectCollectionRequest,
  UpdateCollectionRequest,
  UpdateMintedCollectionRequest,
  VoteRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from '../Dataset';

export class CollectionDataset<D extends Dataset> extends DatasetClass<D, Collection> {
  create = this.sendRequest(WEN_FUNC.createCollection)<CreateCollectionRequest>;

  update = this.sendRequest(WEN_FUNC.updateCollection)<
    UpdateCollectionRequest | UpdateMintedCollectionRequest
  >;

  reject = this.sendRequest(WEN_FUNC.rejectCollection)<RejectCollectionRequest>;

  mint = this.sendRequest(WEN_FUNC.mintCollection)<CollectionMintRequest>;

  vote = this.sendRequest(WEN_FUNC.voteController)<VoteRequest>;

  rank = this.sendRequest(WEN_FUNC.rankController)<RankRequest>;

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
