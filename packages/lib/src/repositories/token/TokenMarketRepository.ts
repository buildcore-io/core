import {
  Opr,
  PublicCollections,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@build-5/interfaces';
import { Observable } from 'rxjs';
import { Build5Env, getTokenPriceUrl } from '../../Config';
import { getSessionId } from '../../Session';
import { toQueryParams, wrappedFetch } from '../../fetch.utils';
import { fetchLive } from '../../observable';
import { CrudRepository } from '../CrudRepository';

export interface TokenPriceResponse {
  id: string;
  price: number;
  usdPrice: number;
}

export class TokenMarketRepository extends CrudRepository<TokenTradeOrder> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.TOKEN_MARKET);
  }

  /**
   * Returns the current market price for a token
   * @param token - Token id
   * @returns
   */
  public getTokenPrice = async (token: string) => {
    const response = await wrappedFetch(getTokenPriceUrl(this.env), { token });
    return (response as Record<string, unknown>).price;
  };

  public getTokenPriceLive = (token: string): Observable<TokenPriceResponse> => {
    const params = { token, sessionId: getSessionId(this.env) };
    const url = getTokenPriceUrl(this.env) + toQueryParams(params);
    return fetchLive<TokenPriceResponse>(this.env, url);
  };

  /**
   * Returns the current market price for a token in USD
   * @param token - Token id
   * @returns
   */
  public getTokenPriceInUsd = async (token: string) => {
    const response = await wrappedFetch(getTokenPriceUrl(this.env), { token });
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
