import { Injectable } from '@angular/core';
import { Space, Token, TokenDistribution, TokenStats } from '@soonaverse/interfaces';
import { BehaviorSubject, map, Observable, of } from 'rxjs';

export enum TokenAction {
  EDIT = 'edit',
  MINT = 'mint',
}

@Injectable({
  providedIn: 'any',
})
export class DataService {
  public token$: BehaviorSubject<Token | undefined> = new BehaviorSubject<Token | undefined>(
    undefined,
  );
  public tokenStats$: BehaviorSubject<TokenStats | undefined> = new BehaviorSubject<
    TokenStats | undefined
  >(undefined);
  public isGuardianInRankModeratorSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false,
  );
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(
    undefined,
  );
  public distributions$: BehaviorSubject<TokenDistribution[] | undefined> = new BehaviorSubject<
    TokenDistribution[] | undefined
  >(undefined);
  public triggerAction$: BehaviorSubject<TokenAction | undefined> = new BehaviorSubject<
    TokenAction | undefined
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
