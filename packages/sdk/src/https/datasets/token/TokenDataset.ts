import {
  CanelPublicSaleRequest,
  CreditTokenRequest,
  Dataset,
  EnableTokenTradingRequest,
  GetManyAdvancedRequest,
  ImportMintedTokenRequest,
  Opr,
  OrderTokenRequest,
  Rank,
  RankRequest,
  SetTokenForSaleRequest,
  Token,
  TokenCreateRequest,
  TokenMintRequest,
  TokenStatus,
  TokenUpdateRequest,
  Transaction,
  Vote,
  VoteRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from '../Dataset';

export class TokenDataset<D extends Dataset> extends DatasetClass<D, Token> {
  create = this.sendRequest(WEN_FUNC.createToken)<TokenCreateRequest, Token>;

  update = this.sendRequest(WEN_FUNC.updateToken)<TokenUpdateRequest, Token>;

  setAvailableForSale = this.sendRequest(WEN_FUNC.setTokenAvailableForSale)<
    SetTokenForSaleRequest,
    Token
  >;

  cancelPublicSale = this.sendRequest(WEN_FUNC.cancelPublicSale)<CanelPublicSaleRequest, Token>;

  order = this.sendRequest(WEN_FUNC.orderToken)<OrderTokenRequest, Transaction>;

  credit = this.sendRequest(WEN_FUNC.creditToken)<CreditTokenRequest, Transaction>;

  mint = this.sendRequest(WEN_FUNC.mintTokenOrder)<TokenMintRequest, Transaction>;

  enableTrading = this.sendRequest(WEN_FUNC.enableTokenTrading)<EnableTokenTradingRequest, Token>;

  importMintedToken = this.sendRequest(WEN_FUNC.importMintedToken)<
    ImportMintedTokenRequest,
    Transaction
  >;

  vote = this.sendRequest(WEN_FUNC.voteController)<VoteRequest, Vote>;

  rank = this.sendRequest(WEN_FUNC.rankController)<RankRequest, Rank>;

  getByMemberLive = (member: string, startAfter?: string, limit?: number) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['member'],
      fieldValue: [member],
      operator: [Opr.EQUAL],
      startAfter,
      limit,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  getByStatusLive = (status: TokenStatus[] = [], startAfter?: string, limit?: number) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: status.map(() => 'status').concat('public'),
      fieldValue: (status as (string | boolean)[]).concat(true),
      operator: status.map(() => Opr.EQUAL).concat(Opr.EQUAL),
      startAfter,
      limit,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
