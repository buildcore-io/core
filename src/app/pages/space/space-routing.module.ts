import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from './../../@core/utils/router.utils';
import { AwardsPage } from "./pages/awards/awards.page";
import { FundingPage } from './pages/funding/funding.page';
import { MembersPage } from "./pages/members/members.page";
import { OverviewPage } from './pages/overview/overview.page';
import { ProposalsPage } from "./pages/proposals/proposals.page";
import { SpacePage } from "./pages/space/space.page";

const routes: Routes = [
  {
    path: ROUTER_UTILS.config.space.space,
    component: SpacePage,
    children: [
      { path: '', component: OverviewPage },
      { path: ROUTER_UTILS.config.space.overview, component: OverviewPage },
      { path: ROUTER_UTILS.config.space.funding, component: FundingPage },
      { path: ROUTER_UTILS.config.space.awards, component: AwardsPage },
      { path: ROUTER_UTILS.config.space.members, component: MembersPage },
      { path: ROUTER_UTILS.config.space.proposals, component: ProposalsPage }
    ]
  },
  {
    path: '',
    redirectTo: '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.spaces
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SpaceRoutingModule { }
