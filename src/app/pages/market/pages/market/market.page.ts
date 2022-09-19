import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TabSection } from '@components/tabs/tabs.component';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy } from '@ngneat/until-destroy';
import { FilterService } from '../../services/filter.service';

export const marketSections = [
  { route: `../${ROUTER_UTILS.config.market.collections}`, label: $localize`Collections` },
  { route: `../${ROUTER_UTILS.config.market.nfts}`, label: $localize`NFTs` },
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
export class MarketPage {

  public sections: TabSection[] = [
    { route: ROUTER_UTILS.config.market.collections, label: $localize`Collections` },
    { route: ROUTER_UTILS.config.market.nfts, label: $localize`NFTs` }
  ];
  public selectedSection?: TabSection;
  public isSearchInputFocused = false;

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
  ) {
    // none;
  }
}
