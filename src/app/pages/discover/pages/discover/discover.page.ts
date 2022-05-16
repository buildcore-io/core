import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { Router } from '@angular/router';
import { TabSection } from '@components/tabs/tabs.component';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { WEN_NAME } from './../../../../../../functions/interfaces/config';
import { FilterService } from './../../services/filter.service';

export const discoverSections: TabSection[] = [
  { route: [ `../${ROUTER_UTILS.config.discover.spaces}`], label: $localize`Spaces` },
  { route: [ `../${ROUTER_UTILS.config.discover.collections}`], label: $localize`Collections` },
  { route: [ `../${ROUTER_UTILS.config.discover.awards}`], label: $localize`Awards` },
  { route: [ `../${ROUTER_UTILS.config.discover.proposals}`], label: $localize`Proposals` },
  { route: [ `../${ROUTER_UTILS.config.discover.members}`], label: $localize`Members` }
];

@UntilDestroy()
@Component({
  selector: 'wen-discover',
  // changeDetection: ChangeDetectionStrategy.OnPush,
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default,

  templateUrl: './discover.page.html',
  styleUrls: ['./discover.page.less']
})
export class DiscoverPage implements OnInit, OnDestroy {
  constructor(
    private titleService: Title,
    public filter: FilterService,
    public deviceService: DeviceService,
    private router: Router
  ) {
    // none;
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Discover');
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.filter.resetSubjects();
  }
}
