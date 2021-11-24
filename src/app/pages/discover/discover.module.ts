import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TabsModule } from "@components/tabs/tabs.module";
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { InfiniteScrollModule } from "ngx-infinite-scroll";
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
import { FilterService } from './services/filter.service';


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
  providers: [ FilterService ],
  imports: [
    CommonModule,
    InfiniteScrollModule,
    ReactiveFormsModule,
    TabsModule,
    RouterModule,
    NzTypographyModule,
    DiscoverRoutingModule,
    NzInputModule,
    NzIconModule,
    NzButtonModule,
    SpaceModule,
    NzSelectModule,
    NzToolTipModule,
    NzTagModule,
    MemberModule,
    ProposalModule,
    AwardModule
  ]
})
export class DiscoverModule { }
