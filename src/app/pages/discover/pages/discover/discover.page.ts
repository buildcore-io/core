import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime } from "rxjs";
import { FilterService, SortOptions } from './../../services/filter.service';

@UntilDestroy()
@Component({
  selector: 'wen-discover',
  templateUrl: './discover.page.html',
  styleUrls: ['./discover.page.less']
})
export class DiscoverPage implements OnInit {
  public sortControl: FormControl = new FormControl(SortOptions.RECENT);
  public filterControl: FormControl = new FormControl(undefined);
  public sections = [
    { route: [ ROUTER_UTILS.config.discover.spaces], label: 'Spaces' },
    { route: [ ROUTER_UTILS.config.discover.awards], label: 'Awards' },
    { route: [ ROUTER_UTILS.config.discover.proposals], label: 'Proposals' },
    { route: [ ROUTER_UTILS.config.discover.members], label: 'Members' }
  ];
  constructor(
    public filter: FilterService
  ) {
    // none;
  }

  public ngOnInit(): void {
    this.sortControl.valueChanges.pipe(untilDestroyed(this)).subscribe((val) => {
      this.filter.selectedSort$.next(val);
    });

    this.filterControl.valueChanges.pipe(
      untilDestroyed(this),
      debounceTime(FilterService.DEBOUNCE_TIME)
    ).subscribe(this.filter.search$);
  }
}
