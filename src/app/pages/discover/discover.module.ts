import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UiModule } from '@components/ui/ui.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { SpacesModule } from '../../components/spaces/spaces.module';
import { AwardsModule } from './../../components/awards/awards.module';
import { MembersModule } from './../../components/members/members.module';
import { ProposalsModule } from './../../components/proposals/proposals.module';
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
    SpacesModule,
    MembersModule,
    ProposalsModule,
    AwardsModule,
    UiModule
  ]
})
export class DiscoverModule { }
