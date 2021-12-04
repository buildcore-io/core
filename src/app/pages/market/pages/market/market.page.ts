import { Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { WEN_NAME } from './../../../../../../functions/interfaces/config';

@Component({
  selector: 'wen-market',
  templateUrl: './market.page.html',
  styleUrls: ['./market.page.less']
})
export class MarketPage implements OnInit, OnDestroy {
  constructor(
    private titleService: Title
  ) {
    // none;
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Marketplace');
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
  }
}
