import { Component } from '@angular/core';
import { ROUTER_UTILS } from '@core/utils/router.utils';

// TODO default table content
interface Person {
  key: string;
  name: string;
  date: string;
  option: string;
  amount: number;
}

@Component({
  selector: 'wen-proposal',
  templateUrl: './proposal.page.html',
  styleUrls: ['./proposal.page.less']
})
export class ProposalPage {
  public get urlToSpaces(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.spaces;
  }

  // TODO default table content
  listOfData: Person[] = [
    {
      key: '1',
      name: '@ann',
      date: '1.1.2021',
      option: 'BUILD',
      amount: 32,
    },
    {
      key: '2',
      name: '@adam',
      date: '1.12.2021',
      option: 'BUILD',
      amount: 32,
    },
    {
      key: '3',
      name: '@josef',
      date: '12.1.2021',
      option: 'BUILD',
      amount: 32,
    }
  ];
}
