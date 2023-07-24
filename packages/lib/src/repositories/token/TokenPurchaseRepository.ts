import { Opr, PublicCollections, TokenPurchase } from '@build-5/interfaces';
import { from, map, switchMap } from 'rxjs';
import { Build5Env } from '../../Config';
import { CrudRepository } from '../CrudRepository';
import { GetTokenAvgPriceGroupedLive } from '../groupGet/GetTokenAvgPriceGroupedLive';
import { GetTokenPriceChangeGroupedLive } from '../groupGet/GetTokenPriceChangeGroupedLive';

export class TokenPurchaseRepository extends CrudRepository<TokenPurchase> {
  private readonly getTokenPriceChangeGroupedLive: GetTokenPriceChangeGroupedLive;
  private readonly getTokenAvgPriceGroupedLive: GetTokenAvgPriceGroupedLive;

  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.TOKEN_PURCHASE);
    this.getTokenPriceChangeGroupedLive = new GetTokenPriceChangeGroupedLive(this.env, this.col);
    this.getTokenAvgPriceGroupedLive = new GetTokenAvgPriceGroupedLive(this.env, this.col);
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

  public getAvgPriceLive = (token: string) =>
    from(this.getTokenAvgPriceGroupedLive.get(token)).pipe(
      switchMap((inner) => inner),
      map((result) => result?.avg || 0),
    );

  public getPriceChangeLive = (token: string) =>
    from(this.getTokenPriceChangeGroupedLive.get(token)).pipe(
      switchMap((inner) => inner),
      map((result) => result?.change || 0),
    );
}
