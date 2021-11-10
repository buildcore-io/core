import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AwardsPage } from './pages/awards/awards.page';
import { FundingPage } from './pages/funding/funding.page';
import { MembersPage } from './pages/members/members.page';
import { OverviewPage } from './pages/overview/overview.page';
import { ProposalsPage } from './pages/proposals/proposals.page';
import { SpacePage } from './pages/space/space.page';
import { SpaceRoutingModule } from './space-routing.module';

@NgModule({
  declarations: [
    SpacePage,
    OverviewPage,
    ProposalsPage,
    AwardsPage,
    FundingPage,
    MembersPage
  ],
  imports: [
    CommonModule,
    SpaceRoutingModule,
  ]
})
export class SpaceModule { }
