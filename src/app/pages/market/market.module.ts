import { MarketRoutingModule } from './market-routing.module';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MarketPage } from './pages/market/market.page';

@NgModule({
  declarations: [
    MarketPage
  ],
  imports: [
    CommonModule,
    MarketRoutingModule
  ]
})
export class MarketModule { }
