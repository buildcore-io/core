import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { ProfilePage } from './pages/profile/profile.page';

const routes: Routes = [
  { path: ROUTER_UTILS.config.member.profile, component: ProfilePage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserRoutingModule {}
