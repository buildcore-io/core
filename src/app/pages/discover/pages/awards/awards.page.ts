import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { UntilDestroy } from '@ngneat/until-destroy';
import { discoverSections } from "@pages/discover/pages/discover/discover.page";
import { Timestamp } from "firebase/firestore";
import { defaultPaginationItems } from "src/app/@algolia/algolia.options";
import { AlgoliaService } from "src/app/@algolia/services/algolia.service";
import { FilterService } from './../../services/filter.service';

export enum HOT_TAGS {
  ALL = 'All',
  ACTIVE = 'Active',
  COMPLETED = 'Completed'
}

@UntilDestroy()
@Component({
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default
})
export class AwardsPage {
  config = {
    indexName: 'award',
    searchClient: this.algoliaService.searchClient,
  };
  sections = discoverSections;
  sortItems = [
    { value: 'award', label: 'Recent' },
    { value: 'award_createdOn_desc', label: 'Oldest' },
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
      createdOn: Timestamp.fromMillis(+algolia.createdOn),
      updatedOn: Timestamp.fromMillis(+algolia.updatedOn),
      lastmodified: Timestamp.fromMillis(+algolia.lastmodified),
      endDate: Timestamp.fromMillis(+algolia.endDate)
    }));
  }

}
