import {
  Dataset,
  GetAvgPriceResponse,
  GetManyAdvancedRequest,
  GetPriceChangeResponse,
  Opr,
  TokenPurchase,
} from '@build-5/interfaces';
import { from, map, switchMap } from 'rxjs';
import GetTokenAvgPriceGroupedLive from '../../get/GetTokenAvgPriceGroupedLive';
import GetTokenPriceChangeGroupedLive from '../../get/GetTokenPriceChangeGroupedLive';
import { DatasetClass } from '../Dataset';

export class TokenPurchaseDataset<D extends Dataset> extends DatasetClass<D, TokenPurchase> {
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
