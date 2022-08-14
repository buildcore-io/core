import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { TokenApi } from '@api/token.api';
import { DeviceService } from '@core/services/device';
import { getItem, setItem, StorageItem } from '@core/utils';
import { GLOBAL_DEBOUNCE_TIME } from "@functions/interfaces/config";
import { Token } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, debounceTime, map, Observable, Subscription } from 'rxjs';
import { tokensSections } from '../tokens/tokens.page';

@UntilDestroy()
@Component({
  selector: 'wen-trading-pairs',
  templateUrl: './trading-pairs.page.html',
  styleUrls: ['./trading-pairs.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradingPairsPage implements OnInit, OnDestroy {
  public tokens$: BehaviorSubject<Token[] | undefined> = new BehaviorSubject<Token[] | undefined>(undefined);
  private dataStore: Token[][] = [];
  public filterControl: FormControl;
  public sections = tokensSections;
  public favourites: string[] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public deviceService: DeviceService,
    private tokenApi: TokenApi,
    private cd: ChangeDetectorRef
  ) {
    this.filterControl = new FormControl('');
  }

  public ngOnInit(): void {
    this.listen();
    this.filterControl.valueChanges.pipe(untilDestroyed(this), debounceTime(GLOBAL_DEBOUNCE_TIME)).subscribe((val: any) => {
      if (val && val.length > 0) {
        this.listen(val);
      } else {
        this.listen();
      }
    });
    this.favourites = getItem(StorageItem.FavouriteTokens) as string[];
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
    return this.tokenApi.tradingPairs(last, search);
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
    this.cd.markForCheck();
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

  public favouriteClick(token: Token): void {
    if (this.favourites.includes(token.uid)) {
      this.favourites = this.favourites.filter((t) => t !== token.uid);
    } else {
      this.favourites = [...this.favourites, token.uid];
    }

    setItem(StorageItem.FavouriteTokens, this.favourites);
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

