import { Component } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { AlgoliaService } from '@components/algolia/services/algolia.service';
import { DeviceService } from '@core/services/device';
import { FilterStorageService } from '@core/services/filter-storage';
import { UntilDestroy } from '@ngneat/until-destroy';
import { InstantSearchConfig } from 'angular-instantsearch/instantsearch/instantsearch';
import { tokensSections } from '../tokens/tokens.page';

@UntilDestroy()
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: 'wen-launchpad',
  templateUrl: './launchpad.page.html',
  styleUrls: ['./launchpad.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
})
export class LaunchpadPage {
  public config: InstantSearchConfig;
  public sections = tokensSections;

  constructor(
    public deviceService: DeviceService,
    public filterStorageService: FilterStorageService,
    public algoliaService: AlgoliaService
  ) {
    this.config = {
      indexName: 'token',
      searchClient: this.algoliaService.searchClient,
      initialUiState: {
        token: this.filterStorageService.tokensLaunchpadFilters$.value
      }
    };
  }

  public convertAllToSoonaverseModel(algoliaItems: any[]) {
    return algoliaItems.map(algolia => ({
      ...algolia,
      createdOn: Timestamp.fromMillis(+algolia.createdOn),
      mintedClaimedOn: Timestamp.fromMillis(+algolia.mintedClaimedOn)
    }));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
