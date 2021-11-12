import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ROUTER_UTILS } from '@core/utils/router.utils';
const iotaToken = 'assets/mocks/iota-token.png';
const iota = 'assets/mocks/iota-treasury.png';
const soonlabsToken = 'assets/mocks/soonlabs-token.png';
const soonlabs = 'assets/mocks/soonlabs.png';

@Component({
  selector: 'wen-space',
  templateUrl: './space.page.html',
  styleUrls: ['./space.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpacePage implements OnInit {

  constructor() { }

  ngOnInit(): void {
    // none.
  }

  public get urlToSpaces(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.spaces;
  }

  sections = [
    { route: 'overview', label: 'Overview' },
    { route: 'proposals', label: 'Proposals' },
    { route: 'awards', label: 'Awards' },
    { route: 'funding', label: 'Funding' },
    { route: 'members', label: 'Members' }
  ]

  space = { id: 1, title: 'IOTA Treasury', description: 'The IOTA Community will be able to vote to allocate all unclaimed tokens from previous network updates into anothe', members: 20, cover: iota, token: iotaToken, link: 'link Github' };
}
