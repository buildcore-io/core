import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { NftApi } from '@api/nft.api';
import { DEFAULT_SPACE, SelectSpaceOption } from '@components/space/components/select-space/select-space.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FilterService } from '@pages/market/services/filter.service';
import { SortOptions } from '@pages/market/services/sort-options.interface';
import { Collection, Space } from 'functions/interfaces/models';
import { Nft } from 'functions/interfaces/models/nft';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';

export enum HOT_TAGS {
  ALL = 'All',
  AVAILABLE = 'Available',
  OWNED = 'Owned',
  SPACE = 'SPACE'
}

@UntilDestroy()
@Component({
  selector: 'wen-nfts',
  templateUrl: './nfts.page.html',
  styleUrls: ['./nfts.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NFTsPage implements OnInit, OnDestroy {
  public sortControl: FormControl;
  public spaceControl: FormControl;
  public nfts$: BehaviorSubject<Nft[]|undefined> = new BehaviorSubject<Nft[]|undefined>(undefined);
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.AVAILABLE, HOT_TAGS.OWNED];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);
  private dataStore: Nft[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public cache: CacheService,
    public nftApi: NftApi,
    private storageService: StorageService,
    private cacheService: CacheService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.spaceControl = new FormControl(this.storageService.selectedSpace.getValue() || DEFAULT_SPACE.value);
  }

  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || []).map((o) => ({
        label: o.name || o.uid,
        value: o.uid,
        img: o.avatarUrl
    }));
  }

  public ngOnInit(): void {
    this.filter.selectedSort$.pipe(skip(1), untilDestroyed(this)).subscribe(() => {
      this.listen();
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
    this.selectedTags$.pipe(untilDestroyed(this)).subscribe(() => {
      if (this.filter.search$.value && this.filter.search$.value.length > 0) {
        this.listen(this.filter.search$.value);
      } else {
        this.listen();
      }
    });

    this.spaceControl.valueChanges.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj && obj !== DEFAULT_SPACE.value) {
        this.selectedTags$.next([HOT_TAGS.SPACE]);
      } else {
        this.selectedTags$.next([HOT_TAGS.ALL]);
      }
    });
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public getHandler(last?: any, search?: string): Observable<Nft[]> {
    if (this.filter.selectedSort$.value === SortOptions.PRICE_LOW) {
      if (this.selectedTags$.value[0] === HOT_TAGS.SPACE) {
        return this.nftApi.lowToHighSpace(this.spaceControl.value, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.AVAILABLE) {
        return this.nftApi.lowToHighAvailable(last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.OWNED) {
        return this.nftApi.lowToHighOwned(last, search);
      } else {
        return this.nftApi.lowToHigh(last, search);
      }
    } else if (this.filter.selectedSort$.value === SortOptions.RECENT) {
      if (this.selectedTags$.value[0] === HOT_TAGS.SPACE) {
        return this.nftApi.topSpace(this.spaceControl.value, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.AVAILABLE) {
        return this.nftApi.topAvailable(last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.OWNED) {
        return this.nftApi.topOwned(last, search);
      } else {
        return this.nftApi.topApproved(last, search);
      }
    } else {
      if (this.selectedTags$.value[0] === HOT_TAGS.SPACE) {
        return this.nftApi.highToLowSpace(this.spaceControl.value, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.AVAILABLE) {
        return this.nftApi.highToLowAvailable(last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.OWNED) {
        return this.nftApi.highToLowOwned(last, search);
      } else {
        return this.nftApi.highToLow(last, search);
      }
    }
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.nfts$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    this.subscriptions$.push(this.getHandler(this.nfts$.value[this.nfts$.value.length - 1]._doc).subscribe(this.store.bind(this, this.dataStore.length)));
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

  public getCollection(col?: string|null): Collection|undefined {
    if (!col) {
      return undefined;
    }

    return this.cacheService.allCollections$.value.find((d) => {
      return d.uid === col;
    });
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.nfts$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.nfts$.pipe(map(() => {
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
    this.nfts$.next(undefined);
  }
}
