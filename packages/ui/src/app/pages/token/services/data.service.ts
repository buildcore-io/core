import { Injectable } from '@angular/core';
import { Space, Token, TokenDistribution } from '@soon/interfaces';
import { BehaviorSubject, map, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'any',
})
export class DataService {
  public token$: BehaviorSubject<Token | undefined> = new BehaviorSubject<Token | undefined>(
    undefined,
  );
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(
    undefined,
  );
  public distributions$: BehaviorSubject<TokenDistribution[] | undefined> = new BehaviorSubject<
    TokenDistribution[] | undefined
  >(undefined);
  public distributionsBought$: Observable<TokenDistribution[]> = of([]);
  public memberDistribution$?: BehaviorSubject<TokenDistribution | undefined> = new BehaviorSubject<
    TokenDistribution | undefined
  >(undefined);

  constructor() {
    this.distributionsBought$ = this.distributions$.pipe(
      map((dis: TokenDistribution[] | undefined) => {
        return (
          dis?.filter((d: TokenDistribution) => {
            return d && (d.totalDeposit || d.totalBought);
          }) || []
        );
      }),
    );
  }

  public resetSubjects(): void {
    // Clean up all streams.
    this.token$.next(undefined);
    this.space$.next(undefined);
    this.distributions$.next(undefined);
  }
}
