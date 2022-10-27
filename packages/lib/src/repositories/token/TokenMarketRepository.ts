import { GetTokenPrice, PublicCollections, TokenTradeOrder } from '@soon/interfaces';
import axios from 'axios';
import { getTokenPriceUrl, SoonEnv } from '../../Config';
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
    const data: GetTokenPrice = {
      token,
    };
    const response = await axios({
      method: 'post',
      url: getTokenPriceUrl(this.env),
      data,
    });
    return response.data.price;
  };
}
