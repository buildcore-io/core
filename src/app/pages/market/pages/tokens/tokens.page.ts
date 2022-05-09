import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { TokenApi } from '@api/token.api';
import { DEFAULT_SPACE, SelectSpaceOption } from '@components/space/components/select-space/select-space.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { Space } from '@functions/interfaces/models';
import { Token, TokenStatus } from '@functions/interfaces/models/token';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FilterService } from '@pages/market/services/filter.service';
import { SortOptions } from '@pages/market/services/sort-options.interface';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';

export enum AddedCategories {
  ALL = 'All'
}

export enum HOT_TAGS {
  ALL = 'All',
  STATUS = 'STATUS',
  SPACE = 'SPACE'
}

@UntilDestroy()
@Component({
  selector: 'wen-tokens',
  templateUrl: './tokens.page.html',
  styleUrls: ['./tokens.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokensPage implements OnInit, OnDestroy {
  public sortControl: FormControl;
  public spaceControl: FormControl;
  public statusControl: FormControl;
  public tokens$: BehaviorSubject<Token[]|undefined> = new BehaviorSubject<Token[]|undefined>(undefined);
  public statuses: string[] = [AddedCategories.ALL, TokenStatus.AVAILABLE, TokenStatus.PROCESSING, TokenStatus.PRE_MINTED];
  public statusLabels: string[] = [$localize`All`, $localize`Available`, $localize`Processing`, $localize`Pre-Minted`];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);
  private dataStore: Token[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public deviceService: DeviceService,
    public cache: CacheService,
    public filter: FilterService,
    public tokenApi: TokenApi,
    private storageService: StorageService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.spaceControl = new FormControl(this.storageService.selectedSpace.getValue() || DEFAULT_SPACE.value);
    this.statusControl = new FormControl(AddedCategories.ALL);
  }

  public ngOnInit(): void {
    this.filter.selectedSort$.pipe(skip(1), untilDestroyed(this)).subscribe(() => {
      if (this.filter.search$.value && this.filter.search$.value.length > 0) {
        this.listen(this.filter.search$.value);
      } else {
        this.listen();
      }
    });

    this.filter.search$.pipe(skip(1), untilDestroyed(this)).subscribe((val: any) => {
      if (val && val.length > 0) {
        this.listen(val);
      } else {
        this.listen();
      }
    });

    this.sortControl.valueChanges.pipe(untilDestroyed(this)).subscribe((val: any) => {
      this.filter.selectedSort$.next(val);
    });

    // Init listen.
    this.selectedTags$.pipe(untilDestroyed(this)).subscribe((o) => {
      if (o.indexOf(HOT_TAGS.STATUS) === -1 && this.statusControl.value !== AddedCategories.ALL) {
        this.statusControl.setValue(AddedCategories.ALL, { emitEvent: false })
      }

      if (o.indexOf(HOT_TAGS.SPACE) === -1 && this.spaceControl.value !== DEFAULT_SPACE.value) {
        this.spaceControl.setValue(DEFAULT_SPACE.value, { emitEvent: false })
      }

      if (this.filter.search$.value && this.filter.search$.value.length > 0) {
        this.listen(this.filter.search$.value);
      } else {
        this.listen();
      }
    });

    this.spaceControl.valueChanges.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj && obj !== DEFAULT_SPACE.value) {
        this.selectedTags$.next([HOT_TAGS.SPACE]);
      } else if (obj === DEFAULT_SPACE.value) {
        this.selectedTags$.next([HOT_TAGS.ALL]);
      }
    });

    this.statusControl.valueChanges.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj && obj !== AddedCategories.ALL) {
        this.selectedTags$.next([HOT_TAGS.STATUS]);
      } else if (obj === AddedCategories.ALL) {
        this.selectedTags$.next([HOT_TAGS.ALL]);
      }
    });
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.tokens$.next(undefined);
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public getHandler(last?: any, search?: string): Observable<Token[]> {
    if (this.filter.selectedSort$.value === SortOptions.PRICE_LOW) {
      if (this.selectedTags$.value[0] === HOT_TAGS.SPACE) {
        return this.tokenApi.lowToHighSpace(this.spaceControl.value, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.STATUS) {
        return this.tokenApi.lowToHighStatus(this.statusControl.value, last, search);
      } else {
        return this.tokenApi.lowToHigh(last, search);
      }
    } else if (this.filter.selectedSort$.value === SortOptions.RECENT) {
      if (this.selectedTags$.value[0] === HOT_TAGS.SPACE) {
        return this.tokenApi.topSpace(this.spaceControl.value, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.STATUS) {
        return this.tokenApi.topStatus(this.statusControl.value, last, search);
      } else {
        return this.tokenApi.top(last, search);
      }
    } else {
      if (this.selectedTags$.value[0] === HOT_TAGS.SPACE) {
        return this.tokenApi.highToLowSpace(this.spaceControl.value, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.STATUS) {
        return this.tokenApi.highToLowStatus(this.statusControl.value, last, search);
      } else {
        return this.tokenApi.highToLow(last, search);
      }
    }
  }

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || []).map((o) => ({
      label: o.name || o.uid,
      value: o.uid,
      img: o.avatarUrl
    }));
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

    this.subscriptions$.push(this.getHandler(this.tokens$.value[this.tokens$.value.length - 1]._doc).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
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

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.dataStore = [];
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
    this.tokens$.next(undefined);
  }
}
