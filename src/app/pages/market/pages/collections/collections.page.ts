import {ChangeDetectionStrategy, Component} from '@angular/core';
import { CollectionApi } from '@api/collection.api';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { UntilDestroy } from '@ngneat/until-destroy';
import { FilterService } from '@pages/market/services/filter.service';

import { Timestamp } from "firebase/firestore";
import {AlgoliaService} from "@Algolia/services/algolia.service";
import {marketSections} from "@pages/market/pages/market/market.page";
import {defaultPaginationItems} from "@Algolia/algolia.options";

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
    { value: 'collection', label: 'Recent' },
    { value: 'collection_price_asc', label: 'Low to High' },
    { value: 'collection_price_desc', label: 'High to Low' },
  ];
  paginationItems = defaultPaginationItems;

  constructor(
    public filter: FilterService,
    public collectionApi: CollectionApi,
    public deviceService: DeviceService,
    public cache: CacheService,
    public readonly algoliaService: AlgoliaService,
  ) {
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
}
