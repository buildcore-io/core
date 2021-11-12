import { Component, OnInit } from '@angular/core';
import { ROUTER_UTILS } from '@core/utils/router.utils';

@Component({
  selector: 'wen-proposal',
  templateUrl: './proposal.page.html',
  styleUrls: ['./proposal.page.less']
})
export class ProposalPage implements OnInit {

  constructor() { }

  ngOnInit(): void {
    // none.
  }

  public get urlToSpaces(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.spaces;
  }
}
