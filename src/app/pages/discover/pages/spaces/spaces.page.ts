import { ChangeDetectionStrategy, Component } from '@angular/core';
import { defaultPaginationItems } from "@components/algolia/algolia.options";
import { AlgoliaService } from "@components/algolia/services/algolia.service";
import { CollapseType } from '@components/collapse/collapse.component';
import { DeviceService } from '@core/services/device';
import { FilterStorageService } from '@core/services/filter-storage';
import { UntilDestroy } from '@ngneat/until-destroy';
import { discoverSections } from "@pages/discover/pages/discover/discover.page";
import { InstantSearchConfig } from 'angular-instantsearch/instantsearch/instantsearch';
import { Timestamp } from "firebase/firestore";
import { Subject } from 'rxjs';
import { FilterService } from './../../services/filter.service';

export enum HOT_TAGS {
  ALL = 'All',
  OPEN = 'Open'
}

@UntilDestroy()
@Component({
  templateUrl: './spaces.page.html',
  styleUrls: ['./spaces.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default

})
export class SpacesPage {
  config: InstantSearchConfig;
  sections = discoverSections;
  paginationItems = defaultPaginationItems;
  reset$ = new Subject<void>();
  sortOpen = true;

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public filterStorageService: FilterStorageService,
    public readonly algoliaService: AlgoliaService,
  ) {
    this.config = {
      indexName: 'space',
      searchClient: this.algoliaService.searchClient,
      initialUiState: {
        space: this.filterStorageService.discoverSpacesFilters$.value
      }
    };
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public convertAllToSoonaverseModel(algoliaItems: any[]) {
    return algoliaItems.map(algolia => ({
      ...algolia,
      createdOn: Timestamp.fromMillis(+algolia.createdOn),
      updatedOn: Timestamp.fromMillis(+algolia.updatedOn),
      lastmodified: Timestamp.fromMillis(+algolia.lastmodified),
      endDate: algolia.endDate ? Timestamp.fromMillis(+algolia.endDate) : null
    }));
  }

  public get collapseTypes(): typeof CollapseType {
    return CollapseType;
  }
}
