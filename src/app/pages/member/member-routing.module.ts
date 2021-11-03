import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { OverviewPage } from './pages/overview/overview.page';
import { ProfilePage } from './pages/profile/profile.page';

const routes: Routes = [
  { path: ROUTER_UTILS.config.member.profile, component: ProfilePage },
  { path: ROUTER_UTILS.config.member.overview, component: OverviewPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserRoutingModule {}
