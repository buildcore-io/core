import {
  GetAvgPriceRequest,
  GetAvgPriceResponse,
  GetPriceChangeRequest,
  GetPriceChangeResponse,
  Opr,
  PublicCollections,
  TokenPurchase,
} from '@build-5/interfaces';
import { map } from 'rxjs';
import { Observable as RxjsObservable } from 'rxjs/internal/Observable';
import { Build5Env, SESSION_ID, getAvgPriceUrl, getPriceChangeUrl } from '../../Config';
import { toQueryParams } from '../../fetch.utils';
import { fetchLive } from '../../observable';
import { CrudRepository } from '../CrudRepository';

export class TokenPurchaseRepository extends CrudRepository<TokenPurchase> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.TOKEN_PURCHASE);
  }

  public getPuchasesLive = (token: string, startAfter?: string) => {
    const params = {
      collection: this.col,
      fieldName: ['token'],
      fieldValue: [token],
      operator: [Opr.EQUAL],
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
      startAfter,
    };
    return this.getManyAdvancedLive(params);
  };

  public getAvgPriceLive = (token: string): RxjsObservable<number> => {
    const params = { token, sessionId: SESSION_ID } as GetAvgPriceRequest;
    const url = getAvgPriceUrl(this.env) + toQueryParams({ ...params });
    return fetchLive<GetAvgPriceResponse>(this.env, url).pipe(map((result) => result.avg));
  };

  public getPriceChangeLive = (token: string): RxjsObservable<number> => {
    const params = { token, sessionId: SESSION_ID } as GetPriceChangeRequest;
    const url = getPriceChangeUrl(this.env) + toQueryParams({ ...params });
    return fetchLive<GetPriceChangeResponse>(this.env, url).pipe(map((result) => result.change));
  };
}
