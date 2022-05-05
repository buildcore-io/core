import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_SPACE, SelectSpaceOption } from '@components/space/components/select-space/select-space.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { Space } from '@functions/interfaces/models';
import { FilterService } from '@pages/market/services/filter.service';
import {marketSections} from "@pages/market/pages/market/market.page";
import {defaultPaginationItems} from "@Algolia/algolia.options";
import {Timestamp} from "firebase/firestore";
import {AlgoliaService} from "@Algolia/services/algolia.service";

export enum AddedCategories {
  ALL = 'All'
}

@Component({
  selector: 'wen-tokens',
  templateUrl: './tokens.page.html',
  styleUrls: ['./tokens.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // TODO investigate how to bypass this....
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default
})
export class TokensPage {

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


  public sortControl: FormControl;
  public spaceControl: FormControl;
  public statusControl: FormControl;
  public statuses: string[] = [AddedCategories.ALL];

  constructor(
    public deviceService: DeviceService,
    public cache: CacheService,
    public filter: FilterService,
    private storageService: StorageService,
    public readonly algoliaService: AlgoliaService,

  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.spaceControl = new FormControl(this.storageService.selectedSpace.getValue() || DEFAULT_SPACE.value);
    this.statusControl = new FormControl(AddedCategories.ALL);
  }

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || []).map((o) => ({
      label: o.name || o.uid,
      value: o.uid,
      img: o.avatarUrl
    }));
  }

  // TODO: needs to be implemented
  public onScroll(): void {
    return;
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
      availableFrom: Timestamp.fromMillis(+algolia.availableFrom),
    }));
  }

}
