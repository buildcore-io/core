import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AlgoliaCheckboxFilterType } from '@components/algolia/algolia-checkbox/algolia-checkbox.component';
import { defaultPaginationItems } from "@components/algolia/algolia.options";
import { AlgoliaService } from "@components/algolia/services/algolia.service";
import { CollapseType } from '@components/collapse/collapse.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { UntilDestroy } from '@ngneat/until-destroy';
import { discoverSections } from "@pages/discover/pages/discover/discover.page";
import { FilterService } from '@pages/discover/services/filter.service';
import { Timestamp } from "firebase/firestore";
import { map, Observable, Subject } from 'rxjs';

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
  openFilters = false;
  reset$ = new Subject<void>();
  spacesLoaded$?: Observable<boolean>;
  sortOpen = true;
  spaceFilterOpen = true;

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public cache: CacheService,
    public readonly algoliaService: AlgoliaService,
  ) { 
    this.spacesLoaded$ = this.cache.allSpaces$.pipe(map(spaces => spaces.length > 0));
  }

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

  public get collapseTypes(): typeof CollapseType {
    return CollapseType;
  }

  public get algoliaCheckboxFilterTypes(): typeof AlgoliaCheckboxFilterType {
    return AlgoliaCheckboxFilterType;
  }
}
