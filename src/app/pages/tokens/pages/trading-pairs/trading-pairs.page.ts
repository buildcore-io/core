import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TokenApi } from '@api/token.api';
import { defaultPaginationItems } from '@components/algolia/algolia.options';
import { AlgoliaService } from '@components/algolia/services/algolia.service';
import { DeviceService } from '@core/services/device';
import { FilterStorageService } from '@core/services/filter-storage';
import { FilterService } from '@pages/market/services/filter.service';
import { InstantSearchConfig } from 'angular-instantsearch/instantsearch/instantsearch';
import { Timestamp } from 'firebase/firestore';
import { Subject } from 'rxjs';
import { tokensSections } from '../tokens/tokens.page';

@Component({
  selector: 'wen-trading-pairs',
  templateUrl: './trading-pairs.page.html',
  styleUrls: ['./trading-pairs.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradingPairsPage {
  config: InstantSearchConfig;
  sections = tokensSections;
  paginationItems = defaultPaginationItems;
  reset$ = new Subject<void>();

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public tokenApi: TokenApi,
    public filterStorageService: FilterStorageService,
    public readonly algoliaService: AlgoliaService
  ) {
    this.config = {
      indexName: 'token',
      searchClient: this.algoliaService.searchClient,
      initialUiState: {
        token: this.filterStorageService.tokensAllTokensFilters$.value
      }
    };
  }

  public trackByUid(_index: number, item: any): number {
    return item.uid;
  }

  public convertAllToSoonaverseModel(algoliaItems: any[]) {
    return algoliaItems.map(algolia => ({
      ...algolia,
      createdOn: Timestamp.fromMillis(+algolia.createdOn)
    }));
  }
}
