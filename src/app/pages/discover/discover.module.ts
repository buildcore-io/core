import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UiModule } from '@components/ui/ui.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { AwardModule } from '../../components/award/award.module';
import { MemberModule } from '../../components/member/member.module';
import { ProposalModule } from '../../components/proposal/proposals.module';
import { SpaceModule } from '../../components/space/space.module';
import { DiscoverRoutingModule } from './discover-routing.module';
import { AwardsPage } from './pages/awards/awards.page';
import { DiscoverPage } from './pages/discover/discover.page';
import { MembersPage } from './pages/members/members.page';
import { ProposalsPage } from './pages/proposals/proposals.page';
import { SpacesPage } from './pages/spaces/spaces.page';


@NgModule({
  declarations: [
    DiscoverPage,
    SpacesPage,
    MembersPage,
    AwardsPage,
    ProposalsPage
  ],
  exports: [
  ],
  imports: [
    CommonModule,
    RouterModule,
    NzTypographyModule,
    DiscoverRoutingModule,
    NzInputModule,
    NzIconModule,
    NzButtonModule,
    SpaceModule,
    MemberModule,
    ProposalModule,
    AwardModule,
    UiModule
  ]
})
export class DiscoverModule { }
