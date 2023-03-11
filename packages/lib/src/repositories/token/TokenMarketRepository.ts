import { PublicCollections, TokenTradeOrder } from '@soonaverse/interfaces';
import { getTokenPriceUrl, SoonEnv } from '../../Config';
import { wrappedFetch } from '../../fetch.utils';
import { CrudRepository } from '../CrudRepository';

export class TokenMarketRepository extends CrudRepository<TokenTradeOrder> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.TOKEN_MARKET);
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

  /**
   * Returns the current market price for a token in USD
   * @param token - Token id
   * @returns
   */
  public getTokenPriceInUsd = async (token: string) => {
    const response = await wrappedFetch(getTokenPriceUrl(this.env), { token });
    return (response as Record<string, unknown>).usdPrice;
  };
}
