import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Title } from "@angular/platform-browser";
import { NavigationEnd, Router } from '@angular/router';
import { TabSection } from '@components/tabs/tabs.component';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { WEN_NAME } from './../../../../../../functions/interfaces/config';

@UntilDestroy()
@Component({
  selector: 'wen-market',
  templateUrl: './market.page.html',
  styleUrls: ['./market.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarketPage implements OnInit, OnDestroy {
  public filterControl: FormControl = new FormControl(undefined);
  public sections: TabSection[] = [
    { route: ROUTER_UTILS.config.market.collections, label: 'Collections' },
    { route: ROUTER_UTILS.config.market.nfts, label: 'NFT`s' }
  ];
  public selectedSection?: TabSection;
  public isSearchInputFocused = false;
  
  constructor(
    private titleService: Title,
    public deviceService: DeviceService,
    private router: Router
  ) {
    // none;
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Marketplace');

    this.setSelectedSection();
    this.router.events
      .pipe(untilDestroyed(this))
      .subscribe((obj) => {
        if(obj instanceof NavigationEnd) {
          this.setSelectedSection();
        }
      });
  }

  private setSelectedSection() {
    this.selectedSection = 
      this.sections.find((r: TabSection) => 
        this.router.url.includes((r.route instanceof Array ? r.route : [r.route]).join('/').toLowerCase()));
  }

  public onSearchIconClick(): void {
    this.isSearchInputFocused = !this.isSearchInputFocused;
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
  }
}