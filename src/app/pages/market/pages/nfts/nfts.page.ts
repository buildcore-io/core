import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NftApi } from '@api/nft.api';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { Collection } from '@functions/interfaces/models';
import { UntilDestroy } from '@ngneat/until-destroy';
import { marketSections } from "@pages/market/pages/market/market.page";
import { FilterService } from '@pages/market/services/filter.service';
import { Timestamp } from "firebase/firestore";
import { defaultPaginationItems } from "src/app/@algolia/algolia.options";
import { AlgoliaService } from "src/app/@algolia/services/algolia.service";

// used in src/app/pages/collection/pages/collection/collection.page.ts
export enum HOT_TAGS {
  ALL = 'All',
  PENDING = 'Pending',
  AVAILABLE = 'Available',
  AUCTION = 'On Auction',
  OWNED = 'Owned',
  SPACE = 'SPACE'
}

@UntilDestroy()
@Component({
  selector: 'wen-nfts',
  templateUrl: './nfts.page.html',
  styleUrls: ['./nfts.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // TODO investigate how to bypass this....
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default
})
export class NFTsPage {
  config = {
    indexName: 'nft',
    searchClient: this.algoliaService.searchClient,
  };
  sections = marketSections;
  sortItems = [
    { value: 'nft', label: 'Recent' },
    { value: 'nft_price_asc', label: 'Low to High' },
    { value: 'nft_price_desc', label: 'High to Low' },
  ];
  paginationItems = defaultPaginationItems;

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public cache: CacheService,
    public nftApi: NftApi,
    private storageService: StorageService,
    private cacheService: CacheService,
    public readonly algoliaService: AlgoliaService
  ) {
  }

  public trackByUid(_index: number, item: any): number {
    return item.uid;
  }

  public getCollection(col?: string|null): Collection|undefined {
    if (!col) {
      return undefined;
    }

    return this.cacheService.allCollections$.value.find((d: Collection) => {
      return d.uid === col;
    });
  }

  public convertAllToSoonaverseModel(algoliaItems: any[]) {
    return algoliaItems.map(algolia => ({
      ...algolia, availableFrom: Timestamp.fromMillis(+algolia.availableFrom),
    }));
  }
}
