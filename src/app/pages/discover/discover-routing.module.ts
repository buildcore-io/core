import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { DiscoverPage } from './pages/discover/discover.page';
import { MembersPage } from './pages/members/members.page';
import { SpacesPage } from './pages/spaces/spaces.page';

const routes: Routes = [
  {
    path: '', component: DiscoverPage,
    children: [
      { path: ROUTER_UTILS.config.discover.spaces, component: SpacesPage, },
      { path: ROUTER_UTILS.config.discover.members, component: MembersPage, }
    ]
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DiscoverRoutingModule { }
