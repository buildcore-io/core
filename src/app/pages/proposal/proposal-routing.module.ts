import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ROUTER_UTILS } from '../../@core/utils/router.utils';
import { OverviewPage } from './pages/overview/overview.page';
import { ProposalPage } from './pages/proposal/proposal.page';

const routes: Routes = [
  {
    path: ROUTER_UTILS.config.proposal.proposal,
    component: ProposalPage,
    children: [
      { path: '', component: OverviewPage },
      { path: ROUTER_UTILS.config.proposal.overview, component: OverviewPage },
    ]
  },
  {
    path: '',
    redirectTo: '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.proposals
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProposalRoutingModule { }
