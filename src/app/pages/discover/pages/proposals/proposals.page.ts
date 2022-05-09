import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { UntilDestroy } from '@ngneat/until-destroy';
import { ProposalApi } from './../../../../@api/proposal.api';
import { FilterService } from './../../services/filter.service';
import {discoverSections} from "@pages/discover/pages/discover/discover.page";
import {defaultPaginationItems} from "@Algolia/algolia.options";
import {AlgoliaService} from "@Algolia/services/algolia.service";
import {Timestamp} from "firebase/firestore";

export enum HOT_TAGS {
  ALL = 'All',
  ACTIVE = 'Active',
  COMPLETED = 'Completed'
}

@UntilDestroy()
@Component({
  templateUrl: './proposals.page.html',
  styleUrls: ['./proposals.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default

})
export class ProposalsPage {
  config = {
    indexName: 'proposal',
    searchClient: this.algoliaService.searchClient,
  };
  sections = discoverSections;
  sortItems = [
    { value: 'proposal', label: 'Recent' },
    { value: 'proposal_createdOn_desc', label: 'Oldest' },
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
      settings: {
        ...algolia.settings,
        startDate: Timestamp.fromMillis(+algolia.settings.startDate),
        endDate: algolia.settings.endDate ? Timestamp.fromMillis(+algolia.settings.endDate): null
      }
    }));
  }

}
