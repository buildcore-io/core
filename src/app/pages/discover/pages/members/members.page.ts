import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { UntilDestroy } from '@ngneat/until-destroy';
import { MemberApi } from './../../../../@api/member.api';
import { CacheService } from './../../../../@core/services/cache/cache.service';
import { AuthService } from './../../../../components/auth/services/auth.service';
import { FilterService } from './../../services/filter.service';
import {discoverSections} from "@pages/discover/pages/discover/discover.page";
import {defaultPaginationItems} from "@Algolia/algolia.options";
import {AlgoliaService} from "@Algolia/services/algolia.service";
import {Timestamp} from "firebase/firestore";

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
}
