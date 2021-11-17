import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { TruncateModule } from './../../@core/pipes/truncate/truncate.module';
import { MembersModule } from './../../components/members/members.module';
import { AwardsPage } from './pages/awards/awards.page';
import { FundingPage } from './pages/funding/funding.page';
import { MembersPage } from './pages/members/members.page';
import { NewPage } from './pages/new/new.page';
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
    MembersPage,
    NewPage
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SpaceRoutingModule,
    TruncateModule,
    MembersModule,
    NzGridModule,
    NzMenuModule,
    NzButtonModule,
    NzTypographyModule,
    NzCardModule,
    NzInputModule,
    NzIconModule,
    NzUploadModule,
    NzAvatarModule
  ]
})
export class SpaceModule { }
