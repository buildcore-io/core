import { Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { NavigationEnd, Router } from '@angular/router';
import { TabSection } from '@components/tabs/tabs.component';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime } from "rxjs";
import { WEN_NAME } from './../../../../../../functions/interfaces/config';
import { FilterService } from './../../services/filter.service';

@UntilDestroy()
@Component({
  selector: 'wen-discover',
  templateUrl: './discover.page.html',
  styleUrls: ['./discover.page.less']
})
export class DiscoverPage implements OnInit, OnDestroy {
  public sections: TabSection[] = [
    { route: [ ROUTER_UTILS.config.discover.spaces], label: 'Spaces' },
    { route: [ ROUTER_UTILS.config.discover.collections], label: 'Collections' },
    { route: [ ROUTER_UTILS.config.discover.awards], label: 'Awards' },
    { route: [ ROUTER_UTILS.config.discover.proposals], label: 'Proposals' },
    { route: [ ROUTER_UTILS.config.discover.members], label: 'Members' }
  ];
  public selectedSection?: TabSection;
  public isSearchInputFocused = false;
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
    this.filter.filterControl.setValue(this.filter.search$.value);
    this.filter.filterControl.valueChanges.pipe(
      debounceTime(FilterService.DEBOUNCE_TIME)
    ).subscribe(this.filter.search$);

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
        (this.router.url || '').includes((r.route instanceof Array ? r.route : [r.route]).join('/').toLowerCase()));
  }

  onSearchIconClick(): void {
    this.isSearchInputFocused = !this.isSearchInputFocused;
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.filter.resetSubjects();
  }
}
