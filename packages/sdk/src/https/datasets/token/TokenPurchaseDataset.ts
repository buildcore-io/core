import {
  Dataset,
  GetAvgPriceResponse,
  GetManyAdvancedRequest,
  GetPriceChangeResponse,
  Opr,
  TokenPurchase,
} from '@buildcore/interfaces';
import { from, map, switchMap } from 'rxjs';
import GetTokenAvgPriceGroupedLive from '../../get/GetTokenAvgPriceGroupedLive';
import GetTokenPriceChangeGroupedLive from '../../get/GetTokenPriceChangeGroupedLive';
import { DatasetClass } from '../Dataset';

/**
 * Token purchase dataset.
 */
export class TokenPurchaseDataset<D extends Dataset> extends DatasetClass<D, TokenPurchase> {
  /**
   * TODO
   * @param token
   * @param startAfter
   * @returns
   */
  getPuchasesLive = (token: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['token'],
      fieldValue: [token],
      operator: [Opr.EQUAL],
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
      startAfter,
    };
    return this.getManyAdvancedLive(params);
  };
  /**
   * TODO
   * @param token
   * @returns
   */
  getAvgPriceLive = (token: string) =>
    from(
      GetTokenAvgPriceGroupedLive.get<GetAvgPriceResponse>({
        origin: this.origin,
        dataset: Dataset.TOKEN,
        setId: token,
        apiKey: this.apiKey,
      }),
    ).pipe(
      switchMap((inner) => inner),
      map((result) => result?.avg || 0),
    );
  /**
   * TODO
   * @param token
   * @returns
   */
  getPriceChangeLive = (token: string) =>
    from(
      GetTokenPriceChangeGroupedLive.get<GetPriceChangeResponse>({
        origin: this.origin,
        dataset: Dataset.TOKEN,
        setId: token,
        apiKey: this.apiKey,
      }),
    ).pipe(
      switchMap((inner) => inner),
      map((result) => result?.change || 0),
    );
}
