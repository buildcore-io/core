import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { NftApi } from '@api/nft.api';
import { DEFAULT_SPACE, SelectSpaceOption } from '@components/space/components/select-space/select-space.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import {Collection, CollectionAccess, Space} from '@functions/interfaces/models';
import { Nft } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FilterService } from '@pages/market/services/filter.service';
import { SortOptions } from '@pages/market/services/sort-options.interface';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import algoliasearch from "algoliasearch/lite";
import { Timestamp } from "firebase/firestore";
import {TabSection} from "@components/tabs/tabs.component";
import {ROUTER_UTILS} from "@core/utils/router.utils";
import {AlgoliaService} from "@core/services/algolia/algolia.service";

export enum HOT_TAGS {
  ALL = 'All',
  PENDING = 'Pending',
  AVAILABLE = 'Available',
  AUCTION = 'On Auction',
  OWNED = 'Owned',
  SPACE = 'SPACE'
}

const searchClient = algoliasearch(
  '2WGM1RPQKZ',
  '4c4da0d2d8b2d582b6f5f232b75314b4'
);

@UntilDestroy()
@Component({
  selector: 'wen-nfts',
  templateUrl: './nfts.page.html',
  styleUrls: ['./nfts.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // TODO investigate how to bypass this....
  changeDetection: ChangeDetectionStrategy.Default
})
export class NFTsPage implements OnInit, OnDestroy {
  searchParameters = { hitsPerPage: 3 } ;

  config = {
    indexName: 'nft',
    searchClient,
    searchFunction: (helper: any) => {
      console.log('searchFunction called with ', helper);
      helper.search();
      this.cd.detectChanges();
    },
    // @ts-ignore
    onStateChange: ({ uiState, setUiState }) => {
      // Custom logic

      console.log('change uiState=', uiState)

      setUiState(uiState);
      this.cd.detectChanges();
    },
    // initialUiState: {
    //   collection: {
    //     query: 'phone',
    //     page: 5,
    //   },
    // }
  };


  public sortControl: FormControl;
  public spaceControl: FormControl;
  public nfts$: BehaviorSubject<Nft[]|undefined> = new BehaviorSubject<Nft[]|undefined>(undefined);
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.AVAILABLE, HOT_TAGS.AUCTION, HOT_TAGS.OWNED];
  public hotTagsLabels: { [key: string]: string } = {
    [HOT_TAGS.ALL]: $localize`All`,
    [HOT_TAGS.AVAILABLE]: $localize`Available`,
    [HOT_TAGS.AUCTION]: $localize`On Auction`,
    [HOT_TAGS.OWNED]: $localize`Owned`
  }
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.AVAILABLE]);
  private dataStore: Nft[][] = [];
  private subscriptions$: Subscription[] = [];

  public sections: TabSection[] = [
    { route: ROUTER_UTILS.config.market.collections, label: $localize`Collections` },
    { route: ROUTER_UTILS.config.market.nfts, label: $localize`NFT\'s` }
  ];
  public selectedSection?: TabSection;
  public isSearchInputFocused = false;
  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public cache: CacheService,
    public nftApi: NftApi,
    private storageService: StorageService,
    private cacheService: CacheService,
    private cd: ChangeDetectorRef,
    public readonly algoliaService: AlgoliaService
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
      } else {
        this.selectedTags$.next([HOT_TAGS.ALL]);
      }
    });
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    // So we show searching again.
    this.nfts$.next(undefined);
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public getHandler(last?: any, search?: string): Observable<Nft[]> {
    if (this.filter.selectedSort$.value === SortOptions.PRICE_LOW) {
      if (this.selectedTags$.value[0] === HOT_TAGS.SPACE) {
        return this.nftApi.lowToHighSpace(this.spaceControl.value, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.AVAILABLE) {
        return this.nftApi.lowToHighAvailable(last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.AUCTION) {
        return this.nftApi.lowToHighAuction(last, search);
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
      } else if (this.selectedTags$.value[0] === HOT_TAGS.AUCTION) {
        return this.nftApi.topAuction(last, search);
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
      } else if (this.selectedTags$.value[0] === HOT_TAGS.AUCTION) {
        return this.nftApi.highToLowAuction(last, search);
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
    return <BehaviorSubject<boolean>> this.nfts$.pipe(map(() => {
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
  public convertAllToSoonaverseModel(algoliaItems: any[]) {
    console.log(`nft:convertAllToSoonaverseModel ${algoliaItems.length}`, algoliaItems)

    return algoliaItems.map(algolia => ({
      ...algolia, availableFrom: Timestamp.fromMillis(+algolia.availableFrom),
    }));
  }



}
