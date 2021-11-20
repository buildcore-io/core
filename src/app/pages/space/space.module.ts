import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AwardsCardModule } from "@components/awards/components/award-card/award-card.module";
import { UiModule } from '@components/ui/ui.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { TruncateModule } from './../../@core/pipes/truncate/truncate.module';
import { MembersModule } from './../../components/members/members.module';
import { ProposalsCardModule } from './../../components/proposals/components/proposal-card/proposal-card.module';
import { AwardsPage } from './pages/awards/awards.page';
import { MembersPage } from './pages/members/members.page';
import { NewPage } from './pages/new/new.page';
import { OverviewPage } from './pages/overview/overview.page';
import { ProposalsPage } from './pages/proposals/proposals.page';
import { SpacePage } from './pages/space/space.page';
import { TreasuryPage } from './pages/treasury/treasury.page';
import { DataService } from "./services/data.service";
import { SpaceRoutingModule } from './space-routing.module';

@NgModule({
  declarations: [
    SpacePage,
    OverviewPage,
    ProposalsPage,
    AwardsPage,
    TreasuryPage,
    MembersPage,
    NewPage
  ],
  providers: [ DataService ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SpaceRoutingModule,
    TruncateModule,
    MembersModule,
    ProposalsCardModule,
    AwardsCardModule,
    NzGridModule,
    UiModule,
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
