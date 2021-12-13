import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzCardModule } from 'ng-zorro-antd/card';
import { MarketRoutingModule } from './market-routing.module';
import { MarketPage } from './pages/market/market.page';

@NgModule({
  declarations: [
    MarketPage
  ],
  imports: [
    CommonModule,
    MarketRoutingModule,
    NzCardModule,
    LayoutModule
  ]
})
export class MarketModule { }
