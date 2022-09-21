import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CollectionApi } from '@api/collection.api';
import { CollectionHighlightCardType } from '@components/collection/components/collection-highlight-card/collection-highlight-card.component';
import { TabSection } from '@components/tabs/tabs.component';
import { DeviceService } from '@core/services/device';
import { getItem, setItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { environment } from '@env/environment';
import { Collection } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter } from 'rxjs';
import { FilterService } from '../../services/filter.service';

export const marketSections = [
  { route: `../${ROUTER_UTILS.config.market.collections}`, label: $localize`Collections` },
  { route: `../${ROUTER_UTILS.config.market.nfts}`, label: $localize`NFTs` },
];

// TODO: values need to be changed
const HIGHLIGHT_COLLECTIONS = environment.production === false ? [
  '0x8fb5ee76d99fe3ac46311f4a021d7c12c3267754',
  '0x531b6bbb3d34655b3d842876fe6c8f444e8dd3f1'
] : [
  '0x9600b5afbb84f15e0d4c0f90ea60b2b8d7bd0f1e',
  '0x55cbe228505461bf3307a4f1ed951d0a059dd6d0'
];

@UntilDestroy()
@Component({
  selector: 'wen-market',
  templateUrl: './market.page.html',
  styleUrls: ['./market.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // TODO investigate how to bypass this....
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default

})
export class MarketPage implements OnInit {

  public sections: TabSection[] = [
    { route: ROUTER_UTILS.config.market.collections, label: $localize`Collections` },
    { route: ROUTER_UTILS.config.market.nfts, label: $localize`NFTs` }
  ];
  public selectedSection?: TabSection;
  public isSearchInputFocused = false;
  public isMigrationWarningVisible = false;
  public highlightCollections: Collection[] = [];
  public recentlyListedCollections: Collection[] = [];

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    private collectionApi: CollectionApi,
    private cd: ChangeDetectorRef
  ) {
    // none;
  }

  public ngOnInit(): void {
    this.handleMigrationWarning();
    this.listenToHighlightCollections();
    this.listenToRecentlyListedCollections();
  }

  public get collectionHighlightCardTypes(): typeof CollectionHighlightCardType {
    return CollectionHighlightCardType;
  }

  public understandMigrationWarning(): void {
    setItem(StorageItem.CollectionMigrationWarningClosed, true);
    this.isMigrationWarningVisible = false;
    this.cd.markForCheck();
  }

  private handleMigrationWarning(): void {
    const migrationWarningClosed = getItem(StorageItem.CollectionMigrationWarningClosed);
    if (!migrationWarningClosed) {
      this.isMigrationWarningVisible = true;
    }
    this.cd.markForCheck();
  }

  private listenToHighlightCollections(): void {
    this.collectionApi.listenMultiple(HIGHLIGHT_COLLECTIONS)
      .pipe(
        filter(r => r.every(collection => collection)),
        untilDestroyed(this)
      )
      .subscribe(r => {
        this.highlightCollections = r as Collection[];
        this.cd.markForCheck();
      });
  }

  private listenToRecentlyListedCollections(): void {
    this.collectionApi.top(undefined, 2)
      .pipe(untilDestroyed(this))
      .subscribe(r => {
        this.recentlyListedCollections = r;
        this.cd.markForCheck();
      });
  }
}
