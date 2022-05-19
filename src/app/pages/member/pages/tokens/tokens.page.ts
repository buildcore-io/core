import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { MemberApi, TokenWithMemberDistribution } from '@api/member.api';
import { TokenItemType } from '@components/token/components/token-claim-refund/token-claim-refund.component';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsHelper } from '@core/utils/units-helper';
import { Token, TokenStatus } from '@functions/interfaces/models/token';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/member/services/data.service';
import dayjs from 'dayjs';
import { BehaviorSubject, map, Observable, of, Subscription } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-tokens',
  templateUrl: './tokens.page.html',
  styleUrls: ['./tokens.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokensPage implements OnInit, OnDestroy {
  public tokens$: BehaviorSubject<TokenWithMemberDistribution[] | undefined> = new BehaviorSubject<TokenWithMemberDistribution[] | undefined>(undefined);
  public openToken?: TokenWithMemberDistribution | null;
  public tokenActionTypeLabels = {
    [TokenItemType.CLAIM]: $localize`Claim`,
    [TokenItemType.REFUND]: $localize`Refund`
  };
  private dataStore: TokenWithMemberDistribution[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService,
    public data: DataService,
    private memberApi: MemberApi
  ) { }

  public ngOnInit(): void {
    this.data.member$?.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj) {
        this.listen();
      }
    });
    setTimeout(() => {
      console.log(this.tokens$.value);
    }, 2000);
  }

  public getTokenAction(token: TokenWithMemberDistribution): TokenItemType | null {
    if (this.isInCooldown(token)) {
      return TokenItemType.REFUND
    }

    return null;
  }

  public isInCooldown(token?: Token): boolean {
    return (
      !!token?.approved &&
      (token?.status === TokenStatus.AVAILABLE || token?.status === TokenStatus.PROCESSING) &&
      dayjs(token?.coolDownEnd?.toDate()).isAfter(dayjs()) &&
      dayjs(token?.saleStartDate?.toDate()).add(token?.saleLength || 0, 'ms').isBefore(dayjs())
    );
  }

  public formatBest(amount: number | undefined | null): string {
    if (!amount) {
      return '0 Mi';
    }

    return UnitsHelper.formatBest(Number(amount), 2);
  }

  public formatTokenBest(amount?: number|null): string {
    if (!amount) {
      return '0';
    }

    return (amount / 1000 / 1000).toFixed(2).toString();
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.tokens$.next(undefined);
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public getHandler(last?: any, search?: string): Observable<Token[]> {
    if (this.data.member$.value) {
      return this.memberApi.topTokens(this.data.member$.value.uid, undefined, last, undefined);
    } else {
      return of([]);
    }
  }

  public get tokenItemTypes(): typeof TokenItemType {
    return TokenItemType;
  }
  
  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.tokens$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    // Def order field.
    const lastValue = this.tokens$.value[this.tokens$.value.length - 1]._doc;
    this.subscriptions$.push(this.getHandler(lastValue).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.tokens$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>> this.tokens$.pipe(map(() => {
      if (!this.dataStore[this.dataStore.length - 1]) {
        return true;
      }

      return (!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE);
    }));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.dataStore = [];
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
