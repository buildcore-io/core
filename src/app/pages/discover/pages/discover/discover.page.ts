import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ROUTER_UTILS } from '@core/utils/router.utils';

enum SortOptions {
  RECENT = 'recent',
  OLDEST = 'oldest'
}

@Component({
  selector: 'wen-discover',
  templateUrl: './discover.page.html',
  styleUrls: ['./discover.page.less']
})
export class DiscoverPage {
  public sections = [
    { route: [ ROUTER_UTILS.config.discover.spaces], label: 'Spaces' },
    { route: [ ROUTER_UTILS.config.discover.awards], label: 'Awards' },
    { route: [ ROUTER_UTILS.config.discover.proposals], label: 'Proposals' },
    { route: [ ROUTER_UTILS.config.discover.members], label: 'Members' }
  ];
  public sortControl: FormControl = new FormControl(SortOptions.RECENT);
  public hotTags: string[] = ['All', 'Featured'];
  public selectedTags: string[] = ['All'];

  public handleChange(_checked: boolean, tag: string): void {
    this.selectedTags = [tag];
  }

  public get sortOptions(): typeof SortOptions {
    return SortOptions;
  }
}
