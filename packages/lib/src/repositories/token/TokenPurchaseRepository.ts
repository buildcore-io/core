import {
  GetAvgPriceRequest,
  GetAvgPriceResponse,
  GetPriceChangeRequest,
  GetPriceChangeResponse,
  Opr,
  PublicCollections,
  TokenPurchase,
} from '@soonaverse/interfaces';
import { map } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { SoonEnv, getAvgPriceUrl, getPriceChangeUrl } from '../../Config';
import { toQueryParams } from '../../fetch.utils';
import { SoonObservable } from '../../soon_observable';
import { CrudRepository } from '../CrudRepository';

export class TokenPurchaseRepository extends CrudRepository<TokenPurchase> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.TOKEN_PURCHASE);
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

  public getAvgPriceLive = (token: string): Observable<number> => {
    const params = { token } as GetAvgPriceRequest;
    const url = getAvgPriceUrl(this.env) + toQueryParams({ ...params });
    return new SoonObservable<GetAvgPriceResponse>(this.env, url).pipe(map((result) => result.avg));
  };

  public getPriceChangeLive = (token: string): Observable<number> => {
    const params = { token } as GetPriceChangeRequest;
    const url = getPriceChangeUrl(this.env) + toQueryParams({ ...params });
    return new SoonObservable<GetPriceChangeResponse>(this.env, url).pipe(
      map((result) => result.change),
    );
  };
}
