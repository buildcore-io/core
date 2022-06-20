import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CollectionApi } from '@api/collection.api';
import { AlgoliaCheckboxFilterType } from '@components/algolia/algolia-checkbox/algolia-checkbox.component';
import { defaultPaginationItems } from "@components/algolia/algolia.options";
import { AlgoliaService } from "@components/algolia/services/algolia.service";
import { CollapseType } from '@components/collapse/collapse.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { FilterStorageService } from '@core/services/filter-storage';
import { UntilDestroy } from '@ngneat/until-destroy';
import { marketSections } from "@pages/market/pages/market/market.page";
import { FilterService } from '@pages/market/services/filter.service';
import { InstantSearchConfig } from 'angular-instantsearch/instantsearch/instantsearch';
import { Timestamp } from "firebase/firestore";
import { map, Observable, Subject } from 'rxjs';


@UntilDestroy()
@Component({
  selector: 'wen-collections',
  templateUrl: './collections.page.html',
  styleUrls: ['./collections.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // TODO investigate how to bypass this....
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default

})
export class CollectionsPage {
  config: InstantSearchConfig;
  sections = marketSections;
  paginationItems = defaultPaginationItems;
  reset$ = new Subject<void>();
  spacesLoaded$?: Observable<boolean>;
  sortOpen = true;
  saleFilterOpen = true;
  spaceFilterOpen = true;
  categoryFilterOpen = false;
  priceFilterOpen = false;

  constructor(
    public filter: FilterService,
    public collectionApi: CollectionApi,
    public deviceService: DeviceService,
    public cache: CacheService,
    public filterStorageService: FilterStorageService,
    public readonly algoliaService: AlgoliaService
  ) {
    this.spacesLoaded$ = this.cache.allSpaces$.pipe(map(spaces => spaces.length > 0));
    console.log(this.filterStorageService.marketCollectionsFilters$.value);
    this.config = {
      indexName: 'collection',
      searchClient: this.algoliaService.searchClient,
      initialUiState: {
        collection: this.filterStorageService.marketCollectionsFilters$.value
      },
      onStateChange(state) {
        console.log(state.uiState);
        state.setUiState(state.uiState)
      }
    };
  }

  public trackByUid(_index: number, item: any): number {
    return item.uid;
  }

  public convertAllToSoonaverseModel(algoliaItems: any[]) {
    return algoliaItems.map(algolia => ({
      ...algolia,
      createdOn: Timestamp.fromMillis(+algolia.createdOn),
      updatedOn: Timestamp.fromMillis(+algolia.updatedOn),
      lastmodified: Timestamp.fromMillis(+algolia.lastmodified),
      availableFrom: Timestamp.fromMillis(+algolia.availableFrom),
    }));
  }

  public get collapseTypes(): typeof CollapseType {
    return CollapseType;
  }

  public get algoliaCheckboxFilterTypes(): typeof AlgoliaCheckboxFilterType {
    return AlgoliaCheckboxFilterType;
  }
}
