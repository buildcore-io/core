import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { MultiplePage } from './pages/multiple/multiple.page';
import { NewPage } from './pages/new/new.page';
import { NFTPage } from './pages/nft/nft.page';
import { SinglePage } from './pages/single/single.page';

const routes: Routes = [
  {
    path: ROUTER_UTILS.config.nft.nft,
    component: NFTPage
  },
  {
    path: ROUTER_UTILS.config.nft.newNft,
    component: NewPage,
    children: [
      { path: '', redirectTo: ROUTER_UTILS.config.nft.single, pathMatch: 'full' },
      { path: ROUTER_UTILS.config.nft.single, component: SinglePage, },
      { path: ROUTER_UTILS.config.nft.multiple, component: MultiplePage, }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class NftRoutingModule { }
