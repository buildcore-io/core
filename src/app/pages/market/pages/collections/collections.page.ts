import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CollectionApi } from '@api/collection.api';
import { AlgoliaCheckboxFilterType } from '@components/algolia/algolia-checkbox/algolia-checkbox.component';
import { defaultPaginationItems } from "@components/algolia/algolia.options";
import { AlgoliaService } from "@components/algolia/services/algolia.service";
import { CollapseType } from '@components/collapse/collapse.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { UntilDestroy } from '@ngneat/until-destroy';
import { marketSections } from "@pages/market/pages/market/market.page";
import { FilterService } from '@pages/market/services/filter.service';
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
  config = {
    indexName: 'collection',
    searchClient: this.algoliaService.searchClient,
  };
  sections = marketSections;
  sortItems = [
    { value: 'collection', label: $localize`Recent` },
    { value: 'collection_price_asc', label: $localize`Low to High` },
    { value: 'collection_price_desc', label: $localize`High to Low`},
  ];
  paginationItems = defaultPaginationItems;
  openFilters = true;
  reset$ = new Subject<void>();
  spacesLoaded$?: Observable<boolean>;
  sortOpen = true;
  saleFilterOpen = true;
  spaceFilterOpen = true;
  categoryFilterOpen = false;
  priceFilterOpen = true;

  constructor(
    public filter: FilterService,
    public collectionApi: CollectionApi,
    public deviceService: DeviceService,
    public cache: CacheService,
    public readonly algoliaService: AlgoliaService
  ) {
    this.spacesLoaded$ = this.cache.allSpaces$.pipe(map(spaces => spaces.length > 0));
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
