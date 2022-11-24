import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { MemberApi, StakeWithTokenRec, TokenWithMemberDistribution } from '@api/member.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { getItem, setItem, StorageItem } from '@core/utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/member/services/data.service';
import { HelperService } from '@pages/member/services/helper.service';
import { Member, Stake, Token, TokenDrop } from '@soonaverse/interfaces';
import { BehaviorSubject, map, Observable, of, Subscription } from 'rxjs';

export enum TokenItemType {
  CLAIM = 'Claim',
  REFUND = 'Refund',
}

enum FilterOptions {
  TOKENS = 'tokens',
  STAKING = 'staking',
}

@UntilDestroy()
@Component({
  selector: 'wen-tokens',
  templateUrl: './tokens.page.html',
  styleUrls: ['./tokens.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TokensPage implements OnInit, OnDestroy {
  public selectedListControl: FormControl = new FormControl(FilterOptions.TOKENS);
  public tokens$: BehaviorSubject<TokenWithMemberDistribution[] | undefined> = new BehaviorSubject<
    TokenWithMemberDistribution[] | undefined
  >(undefined);
  public stakes$: BehaviorSubject<StakeWithTokenRec[] | undefined> = new BehaviorSubject<
    StakeWithTokenRec[] | undefined
  >(undefined);
  public modifiedTokens$: Observable<TokenWithMemberDistribution[]>;
  public openTokenRefund?: TokenWithMemberDistribution | null;
  public openTokenClaim?: TokenWithMemberDistribution | null;
  public tokenActionTypeLabels = {
    [TokenItemType.CLAIM]: $localize`Claim`,
    [TokenItemType.REFUND]: $localize`Refund`,
  };
  public isNotMintedWarningVisible = false;
  private dataStoreTokens: TokenWithMemberDistribution[][] = [];
  private dataStoreStakes: Stake[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService,
    public data: DataService,
    public helper: HelperService,
    public unitsService: UnitsService,
    private auth: AuthService,
    private memberApi: MemberApi,
    private cd: ChangeDetectorRef,
  ) {
    this.modifiedTokens$ = this.tokens$.pipe(
      map((tokens) => {
        if (!tokens) {
          return [];
        }

        return tokens
          .sort((a, b) => {
            if (a.createdOn && b.createdOn) {
              return b.createdOn.toMillis() - a.createdOn.toMillis();
            }
            return 0;
          })
          .map((token) => {
            return {
              ...token,
              distribution: {
                ...token.distribution,
                tokenDrops: token.distribution.tokenDrops?.length
                  ? [
                      token.distribution.tokenDrops.reduce((acc: TokenDrop, cur: TokenDrop) => ({
                        ...cur,
                        count: acc.count + cur.count,
                      })),
                    ]
                  : undefined,
              },
            };
          });
      }),
      map((tokens) =>
        tokens.filter(
          (t) =>
            (!this.helper.isMinted(t) &&
              (t.distribution.tokenOwned || t.distribution.tokenDrops?.length)) ||
            (this.helper.isMinted(t) &&
              !t.distribution.mintedClaimedOn &&
              (t.distribution.tokenOwned || 0) > 0) ||
            (this.helper.isMinted(t) && (t.distribution.tokenDrops?.[0]?.count || 0) > 0) ||
            (this.helper.salesInProgressOrUpcoming(t) &&
              t.distribution.totalDeposit &&
              !helper.isMinted(t)),
        ),
      ),
    );
  }

  public ngOnInit(): void {
    this.data.member$?.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj) {
        this.listen();
      }
    });
    this.handleNotMintedWarning();
  }

  public handleFilterChange(filter: FilterOptions): void {
    this.selectedListControl.setValue(filter);
    this.cd.markForCheck();
  }

  public get loggedInMember$(): BehaviorSubject<Member | undefined> {
    return this.auth.member$;
  }

  public claim(token: TokenWithMemberDistribution): void {
    this.openTokenClaim = this.tokens$.getValue()?.find((t) => t.uid === token.uid);
    this.cd.markForCheck();
  }

  public get filterOptions(): typeof FilterOptions {
    return FilterOptions;
  }

  private listen(): void {
    this.cancelSubscriptions();
    this.tokens$.next(undefined);
    this.stakes$.next(undefined);
    this.subscriptions$.push(this.getHandlerTokens(undefined).subscribe(this.store.bind(this, 0)));
    this.subscriptions$.push(this.getHandlerStaked(undefined).subscribe(this.store.bind(this, 0)));
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return Array.isArray(arr) && arr.length === 0;
  }

  public getHandlerTokens(last?: any): Observable<Token[]> {
    if (this.data.member$.value) {
      return this.memberApi.topTokens(this.data.member$.value.uid, undefined, last);
    } else {
      return of([]);
    }
  }

  public getHandlerStaked(last?: any): Observable<StakeWithTokenRec[]> {
    if (this.data.member$.value) {
      return this.memberApi.topStakes(this.data.member$.value.uid, undefined, last);
    } else {
      return of([]);
    }
  }

  public get tokenItemTypes(): typeof TokenItemType {
    return TokenItemType;
  }

  public get dataStore(): any {
    return this.selectedListControl.value === FilterOptions.TOKENS
      ? this.dataStoreTokens
      : this.dataStoreStakes;
  }

  public get currentList$(): any {
    return this.selectedListControl.value === FilterOptions.TOKENS ? this.tokens$ : this.stakes$;
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.currentList$.value) {
      return;
    }

    if (
      !this.dataStore[this.dataStore.length - 1] ||
      this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE
    ) {
      return;
    }

    // Def order field.
    const lastValue = this.currentList$.value[this.currentList$.value.length - 1]._doc;
    this.subscriptions$.push(
      this.selectedListControl.value === FilterOptions.TOKENS
        ? this.getHandlerTokens(lastValue).subscribe(this.store.bind(this, this.dataStore.length))
        : this.getHandlerStaked(lastValue).subscribe(this.store.bind(this, this.dataStore.length)),
    );
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.currentList$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.currentList$.pipe(
      map(() => {
        if (!this.dataStore[this.dataStore.length - 1]) {
          return true;
        }

        return (
          !this.dataStore[this.dataStore.length - 1] ||
          this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE
        );
      }),
    );
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public understandNotMintedWarning(): void {
    setItem(StorageItem.NotMintedTokensWarningClosed, true);
    this.isNotMintedWarningVisible = false;
  }

  private handleNotMintedWarning(): void {
    const notMintedWarningClosed = getItem(StorageItem.NotMintedTokensWarningClosed);
    if (!notMintedWarningClosed) {
      this.isNotMintedWarningVisible = true;
    }
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.dataStoreStakes = [];
    this.dataStoreTokens = [];
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
