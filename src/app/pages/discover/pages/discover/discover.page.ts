import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Title } from "@angular/platform-browser";
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime } from "rxjs";
import { WEN_NAME } from './../../../../../../functions/interfaces/config';
import { FilterService, SortOptions } from './../../services/filter.service';

@UntilDestroy()
@Component({
  selector: 'wen-discover',
  templateUrl: './discover.page.html',
  styleUrls: ['./discover.page.less']
})
export class DiscoverPage implements OnInit, OnDestroy {
  public sortControl: FormControl = new FormControl(SortOptions.OLDEST);
  public filterControl: FormControl = new FormControl(undefined);
  public sections = [
    { route: [ ROUTER_UTILS.config.discover.spaces], label: 'Spaces' },
    { route: [ ROUTER_UTILS.config.discover.awards], label: 'Awards' },
    { route: [ ROUTER_UTILS.config.discover.proposals], label: 'Proposals' },
    { route: [ ROUTER_UTILS.config.discover.members], label: 'Members' }
  ];
  constructor(
    private titleService: Title,
    public filter: FilterService
  ) {
    // none;
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Discover');
    this.filterControl.setValue(this.filter.search$.value);
    this.sortControl.valueChanges.pipe(untilDestroyed(this)).subscribe((val) => {
      this.filter.selectedSort$.next(val);
    });

    this.filterControl.valueChanges.pipe(
      debounceTime(FilterService.DEBOUNCE_TIME)
    ).subscribe(this.filter.search$);
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.filter.resetSubjects();
  }
}
