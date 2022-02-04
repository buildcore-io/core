import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { NewPage } from './pages/new/new.page';
import { NFTPage } from './pages/nft/nft.page';

const routes: Routes = [
  {
    path: ROUTER_UTILS.config.nft.root,
    component: NFTPage
  },
  {
    path: ROUTER_UTILS.config.nft.newNft,
    component: NewPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class NftRoutingModule { }
