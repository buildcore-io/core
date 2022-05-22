import { ChangeDetectionStrategy, Component } from '@angular/core';
import { defaultPaginationItems } from "@components/algolia/algolia.options";
import { AlgoliaService } from "@components/algolia/services/algolia.service";
import { CollapseType } from '@components/collapse/collapse.component';
import { DeviceService } from '@core/services/device';
import { UntilDestroy } from '@ngneat/until-destroy';
import { discoverSections } from "@pages/discover/pages/discover/discover.page";
import { Timestamp } from "firebase/firestore";
import { Subject } from 'rxjs';
import { CacheService } from './../../../../@core/services/cache/cache.service';
import { FilterService } from './../../services/filter.service';

@UntilDestroy()
@Component({
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default
})
export class MembersPage {
  config = {
    indexName: 'member',
    searchClient: this.algoliaService.searchClient,
  };
  sections = discoverSections;
  sortItems = [
    { value: 'member', label: 'Recent' },
    { value: 'member_createdOn_desc', label: 'Oldest' },
  ];
  paginationItems = defaultPaginationItems;
  openFilters = false;
  reset$ = new Subject<void>();
  sortOpen = true;

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public cache: CacheService,
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

      spaces: !algolia.spaces ? null : Object.entries(algolia.spaces)
        .forEach((key: any[], value) => ({ [key[0]]: {...key[1], updateOn: Timestamp.fromMillis(+key[1].updateOn), createOn: Timestamp.fromMillis(+key[1].createOn)}}))
    }));
  }

  public get collapseTypes(): typeof CollapseType {
    return CollapseType;
  }
}
