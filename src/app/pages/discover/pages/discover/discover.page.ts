import { Component } from '@angular/core';
import { ROUTER_UTILS } from '@core/utils/router.utils';

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

  public hotTags: string[] = ['All', 'Featured'];
  public selectedTags: string[] = ['All'];

  public handleChange(_checked: boolean, tag: string): void {
    this.selectedTags = [tag];
    // if (checked) {
    //   this.selectedTags.push(tag);
    // } else {
    //   this.selectedTags = this.selectedTags.filter(t => t !== tag);
    // }
  }
}
