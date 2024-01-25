import {
  Build5Request,
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
  create = (req: Build5Request<TokenCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createToken)<TokenCreateRequest, Token>(req);

  update = (req: Build5Request<TokenUpdateRequest>) =>
    this.sendRequest(WEN_FUNC.updateToken)<TokenUpdateRequest, Token>(req);

  setAvailableForSale = (req: Build5Request<SetTokenForSaleRequest>) =>
    this.sendRequest(WEN_FUNC.setTokenAvailableForSale)<SetTokenForSaleRequest, Token>(req);

  cancelPublicSale = (req: Build5Request<CanelPublicSaleRequest>) =>
    this.sendRequest(WEN_FUNC.cancelPublicSale)<CanelPublicSaleRequest, Token>(req);

  order = (req: Build5Request<OrderTokenRequest>) =>
    this.sendRequest(WEN_FUNC.orderToken)<OrderTokenRequest, Transaction>(req);

  credit = (req: Build5Request<CreditTokenRequest>) =>
    this.sendRequest(WEN_FUNC.creditToken)<CreditTokenRequest, Transaction>(req);

  mint = (req: Build5Request<TokenMintRequest>) =>
    this.sendRequest(WEN_FUNC.mintTokenOrder)<TokenMintRequest, Transaction>(req);

  enableTrading = (req: Build5Request<EnableTokenTradingRequest>) =>
    this.sendRequest(WEN_FUNC.enableTokenTrading)<EnableTokenTradingRequest, Token>(req);

  importMintedToken = (req: Build5Request<ImportMintedTokenRequest>) =>
    this.sendRequest(WEN_FUNC.importMintedToken)<ImportMintedTokenRequest, Transaction>(req);

  vote = (req: Build5Request<VoteRequest>) =>
    this.sendRequest(WEN_FUNC.voteController)<VoteRequest, Vote>(req);

  rank = (req: Build5Request<RankRequest>) =>
    this.sendRequest(WEN_FUNC.rankController)<RankRequest, Rank>(req);

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
