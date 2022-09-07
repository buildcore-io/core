import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Timestamp } from "@angular/fire/firestore";
import { NftApi } from '@api/nft.api';
import { AlgoliaCheckboxFilterType } from '@components/algolia/algolia-checkbox/algolia-checkbox.component';
import { defaultPaginationItems } from "@components/algolia/algolia.options";
import { AlgoliaService } from "@components/algolia/services/algolia.service";
import { CollapseType } from '@components/collapse/collapse.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { FilterStorageService } from '@core/services/filter-storage';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { marketSections } from "@pages/market/pages/market/market.page";
import { FilterService } from '@pages/market/services/filter.service';
import { InstantSearchConfig } from 'angular-instantsearch/instantsearch/instantsearch';
import { filter, first, Subject } from 'rxjs';

// used in src/app/pages/collection/pages/collection/collection.page.ts
export enum HOT_TAGS {
  ALL = 'All',
  PENDING = 'Pending',
  AVAILABLE = 'Available',
  AUCTION = 'On Auction',
  OWNED = 'Owned',
  SPACE = 'SPACE'
}

@UntilDestroy()
@Component({
  selector: 'wen-nfts',
  templateUrl: './nfts.page.html',
  styleUrls: ['./nfts.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // TODO investigate how to bypass this....
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default
})
export class NFTsPage implements OnInit {
  config: InstantSearchConfig;
  sections = marketSections;
  paginationItems = defaultPaginationItems;
  reset$ = new Subject<void>();
  sortOpen = true;
  statusFilterOpen = true;
  isOwnedFilterOpen = true;
  spaceFilterOpen = true;
  collectionFilterOpen = true;
  priceFilterOpen = false;

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public cache: CacheService,
    public nftApi: NftApi,
    public filterStorageService: FilterStorageService,
    public cacheService: CacheService,
    public readonly algoliaService: AlgoliaService
  ) {
    this.config = {
      indexName: 'nft',
      searchClient: this.algoliaService.searchClient,
      initialUiState: {
        nft: this.filterStorageService.marketNftsFilters$.value
      }
    };
  }

  public ngOnInit(): void {
    this.filterStorageService.marketNftsFiltersVisible$
      .pipe(
        filter(r => r),
        first(),
        untilDestroyed(this)
      ).subscribe(() => {
        this.cacheService.fetchAllSpaces();
        this.cacheService.fetchAllCollections();
      });
  }

  public trackByUid(_index: number, item: any): number {
    return item.uid;
  }

  public convertAllToSoonaverseModel(algoliaItems: any[]) {
    return algoliaItems.map(algolia => ({
      ...algolia, availableFrom: Timestamp.fromMillis(+algolia.availableFrom),
    }));
  }

  public get collapseTypes(): typeof CollapseType {
    return CollapseType;
  }

  public get algoliaCheckboxFilterTypes(): typeof AlgoliaCheckboxFilterType {
    return AlgoliaCheckboxFilterType;
  }
}
