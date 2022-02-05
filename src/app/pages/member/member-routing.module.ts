import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { ActivityPage } from './pages/activity/activity.page';
import { AwardsPage } from './pages/awards/awards.page';
import { BadgesPage } from './pages/badges/badges.page';
import { MemberPage } from './pages/member/member.page';
import { MemberSpacesComponent } from './pages/spaces/member-spaces.component';

const routes: Routes = [
  {
    path: ROUTER_UTILS.config.member.member,
    component: MemberPage,
    children: [
      {
        path: '',
        redirectTo: ROUTER_UTILS.config.member.activity
      },
      { path: ROUTER_UTILS.config.member.activity, component: ActivityPage },
      { path: ROUTER_UTILS.config.member.awards, component: AwardsPage },
      { path: ROUTER_UTILS.config.member.badges, component: BadgesPage },
      { path: ROUTER_UTILS.config.member.spaces, component: MemberSpacesComponent }
    ]
  },
  {
    path: '',
    redirectTo: '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.spaces
  },
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserRoutingModule {}
