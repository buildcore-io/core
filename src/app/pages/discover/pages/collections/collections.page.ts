import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { UntilDestroy } from '@ngneat/until-destroy';
import { discoverSections } from "@pages/discover/pages/discover/discover.page";
import { FilterService } from '@pages/discover/services/filter.service';
import { Timestamp } from "firebase/firestore";
import { defaultPaginationItems } from "src/app/@algolia/algolia.options";
import { AlgoliaService } from "src/app/@algolia/services/algolia.service";

export enum HOT_TAGS {
  ALL = 'All',
  COLLECTIBLES = 'Collectibles',
  COMMUNITY_DROPS = 'CommunityDrops',
  GENERATED = 'Generated'
}

@UntilDestroy()
@Component({
  selector: 'wen-collections',
  templateUrl: './collections.page.html',
  styleUrls: ['./collections.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default
})
export class CollectionsPage {
  config = {
    indexName: 'collection',
    searchClient: this.algoliaService.searchClient,
  };
  sections = discoverSections;
  sortItems = [
    { value: 'collection', label: 'Recent' },
    { value: 'collection_createdOn_desc', label: 'Oldest' },
  ];
  paginationItems = defaultPaginationItems;

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public readonly algoliaService: AlgoliaService,
  ) { /* */}

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public convertAllToSoonaverseModel(algoliaItems: any[]) {

    return algoliaItems.map(algolia => ({
      ...algolia,
      availableFrom: Timestamp.fromMillis(+algolia.availableFrom),
      createdOn: Timestamp.fromMillis(+algolia.createdOn),
      updatedOn: Timestamp.fromMillis(+algolia.updatedOn),
      lastmodified: Timestamp.fromMillis(+algolia.lastmodified)
    }));
  }

}
