import {
  BuildcoreRequest,
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
} from '@buildcore/interfaces';
import { DatasetClass } from '../Dataset';

/**
 * Token Dataset
 */
export class TokenDataset<D extends Dataset> extends DatasetClass<D, Token> {
  /**
   * Create token.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link TokenCreateRequest}
   * @returns
   */
  create = (req: BuildcoreRequest<TokenCreateRequest>) =>
    this.sendRequest(WEN_FUNC.createToken)<TokenCreateRequest, Token>(req);
  /**
   * Update token.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link TokenUpdateRequest}
   * @returns
   */
  update = (req: BuildcoreRequest<TokenUpdateRequest>) =>
    this.sendRequest(WEN_FUNC.updateToken)<TokenUpdateRequest, Token>(req);
  /**
   * Set token for sale on the launchpad.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link SetTokenForSaleRequest}
   * @returns
   */
  setAvailableForSale = (req: BuildcoreRequest<SetTokenForSaleRequest>) =>
    this.sendRequest(WEN_FUNC.setTokenAvailableForSale)<SetTokenForSaleRequest, Token>(req);
  /**
   * Cancel public token sale.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link CanelPublicSaleRequest}
   * @returns
   */
  cancelPublicSale = (req: BuildcoreRequest<CanelPublicSaleRequest>) =>
    this.sendRequest(WEN_FUNC.cancelPublicSale)<CanelPublicSaleRequest, Token>(req);
  /**
   * Order Token request.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link OrderTokenRequest}
   * @returns
   */
  order = (req: BuildcoreRequest<OrderTokenRequest>) =>
    this.sendRequest(WEN_FUNC.orderToken)<OrderTokenRequest, Transaction>(req);
  /**
   * Credit token request.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link CreditTokenRequest}
   * @returns
   */
  credit = (req: BuildcoreRequest<CreditTokenRequest>) =>
    this.sendRequest(WEN_FUNC.creditToken)<CreditTokenRequest, Transaction>(req);
  /**
   * Update member details.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link MemberUpdateRequest}
   * @returns
   */
  mint = (req: BuildcoreRequest<TokenMintRequest>) =>
    this.sendRequest(WEN_FUNC.mintTokenOrder)<TokenMintRequest, Transaction>(req);
  /**
   * Enable token for trading on a exchange.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link EnableTokenTradingRequest}
   * @returns
   */
  enableTrading = (req: BuildcoreRequest<EnableTokenTradingRequest>) =>
    this.sendRequest(WEN_FUNC.enableTokenTrading)<EnableTokenTradingRequest, Token>(req);
  /**
   * Imported minted token from the chain.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link ImportMintedTokenRequest}
   * @returns
   */
  importMintedToken = (req: BuildcoreRequest<ImportMintedTokenRequest>) =>
    this.sendRequest(WEN_FUNC.importMintedToken)<ImportMintedTokenRequest, Transaction>(req);
  /**
   * Vote on token.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link VoteRequest}
   * @returns
   */
  vote = (req: BuildcoreRequest<VoteRequest>) =>
    this.sendRequest(WEN_FUNC.voteController)<VoteRequest, Vote>(req);
  /**
   * Rank token.
   *
   * @param req Use {@link BuildcoreRequest} with data based on {@link RankRequest}
   * @returns
   */
  rank = (req: BuildcoreRequest<RankRequest>) =>
    this.sendRequest(WEN_FUNC.rankController)<RankRequest, Rank>(req);

  /**
   * Get tokens by member. Real time stream.
   * @param member
   * @param startAfter
   * @param limit
   * @returns
   */
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
  /**
   * Get status for token. Real time stream.
   * @param status
   * @param startAfter
   * @param limit
   * @returns
   */
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
