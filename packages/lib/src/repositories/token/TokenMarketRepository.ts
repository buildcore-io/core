import {
  Opr,
  PublicCollections,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@build-5/interfaces';
import { from, map, switchMap } from 'rxjs';
import { Build5Env, TOKENS, getTokenPriceUrl } from '../../Config';
import { wrappedFetch } from '../../fetch.utils';
import { CrudRepository } from '../CrudRepository';
import { GetTokenPriceGrouped } from '../groupGet/GetTokenPriceGrouped';
import { GetTokenPriceGroupedLive } from '../groupGet/GetTokenPriceGroupedLive';

export interface TokenPriceResponse {
  id: string;
  price: number;
  usdPrice: number;
}

export class TokenMarketRepository extends CrudRepository<TokenTradeOrder> {
  private readonly getTokenPriceGroupedLive: GetTokenPriceGroupedLive;
  private readonly getTokenPriceGrouped: GetTokenPriceGrouped;

  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.TOKEN_MARKET);
    this.getTokenPriceGroupedLive = new GetTokenPriceGroupedLive(this.env, this.col);
    this.getTokenPriceGrouped = new GetTokenPriceGrouped(this.env, this.col);
  }

  /**
   * Returns the current market price for a token
   * @param token - Token id
   * @returns
   */
  public getTokenPrice = (token: string) => this.getTokenPriceGrouped.get(token);

  /**
   * Returns the current market price for a token live
   * @param token - Token id
   * @returns
   */
  public getTokenPriceLive = (token: string) =>
    from(this.getTokenPriceGroupedLive.get(token)).pipe(
      switchMap((inner) => inner),
      map((r) => r || { id: token, price: 0, usdPrice: 0 }),
    );

  /**
   * Returns the current market price for a token in USD
   * @param token - Token id
   * @returns
   */
  public getTokenPriceInUsd = async (token: string) => {
    const response = await wrappedFetch(TOKENS[this.env], getTokenPriceUrl(this.env), { token });
    return (response as Record<string, unknown>).usdPrice;
  };

  public getBidsLive = (
    token: string,
    type: TokenTradeOrderType,
    status: TokenTradeOrderStatus,
    startAfter?: string,
  ) => {
    const params = {
      collection: this.col,
      fieldName: ['token', 'type', 'status'],
      fieldValue: [token, type, status],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['price'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  public getMemberBidsLive = (
    token: string,
    member: string,
    type: TokenTradeOrderType,
    startAfter?: string,
  ) => {
    const params = {
      collection: this.col,
      fieldName: ['token', 'owner', 'type'],
      fieldValue: [token, member, type],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
