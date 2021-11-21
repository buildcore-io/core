import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { MarketPage } from './pages/market/market.page';

const routes: Routes = [
  {
    path: '',
    redirectTo: ROUTER_UTILS.config.market.root,
    pathMatch: 'full',
  },
  {
    path: '',
    component: MarketPage
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MarketRoutingModule { }
