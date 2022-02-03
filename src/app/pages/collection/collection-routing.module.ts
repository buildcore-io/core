import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { CollectionPage } from './pages/collection/collection.page';
import { NewPage } from './pages/new/new.page';

const routes: Routes = [
  {
    path: ROUTER_UTILS.config.collection.root,
    component: CollectionPage
  },
  {
    path: ROUTER_UTILS.config.collection.newCollection,
    component: NewPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CollectionRoutingModule { }
