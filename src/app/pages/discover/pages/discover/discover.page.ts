import { Component } from '@angular/core';
import { ROUTER_UTILS } from '@core/utils/router.utils';

// TODO default filters
const tagsFromServer = ['All', 'Your Favourites', 'Featured', 'Nearly Funded'];

@Component({
  selector: 'wen-discover',
  templateUrl: './discover.page.html',
  styleUrls: ['./discover.page.less']
})
export class DiscoverPage {
  public sections = [

    { route: [ ROUTER_UTILS.config.discover.spaces], label: 'Spaces' },
    { route: [ROUTER_UTILS.config.discover.awards], label: 'Awards' },
    { route: [ROUTER_UTILS.config.discover.proposals], label: 'Proposals' },
    { route: [ ROUTER_UTILS.config.discover.members], label: 'Members' }
  ];

  // TODO filters default logic
  hotTags = tagsFromServer;
  selectedTags: string[] = [];

  handleChange(checked: boolean, tag: string): void {
    if (checked) {
      this.selectedTags.push(tag);
    } else {
      this.selectedTags = this.selectedTags.filter(t => t !== tag);
    }
    console.log('You are interested in: ', this.selectedTags);
  }
}
