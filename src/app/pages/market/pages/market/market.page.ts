import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import { Title } from "@angular/platform-browser";
import { Router } from '@angular/router';
import { TabSection } from '@components/tabs/tabs.component';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy } from '@ngneat/until-destroy';
import { FilterService } from '../../services/filter.service';
import { WEN_NAME } from '@functions/interfaces/config';

export const marketSections = [
  { route: `../${ROUTER_UTILS.config.market.collections}`, label: $localize`Collections` },
  { route: `../${ROUTER_UTILS.config.market.nfts}`, label: $localize`NFT\'s` },
  { route: `../${ROUTER_UTILS.config.market.tokens}`, label: $localize`Token\'s` }

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
export class MarketPage implements OnInit, OnDestroy {

  public sections: TabSection[] = [
    { route: ROUTER_UTILS.config.market.collections, label: $localize`Collections` },
    { route: ROUTER_UTILS.config.market.nfts, label: $localize`NFTs` },
    { route: ROUTER_UTILS.config.market.tokens, label: $localize`Tokens` }
  ];
  public selectedSection?: TabSection;
  public isSearchInputFocused = false;

  constructor(
    public filter: FilterService,
    private titleService: Title,
    public deviceService: DeviceService,
  ) {
    // none;
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Marketplace');
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
  }

}
