import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AwardCardModule } from "@components/award/components/award-card/award-card.module";
import { IconModule } from '@components/icon/icon.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { MemberModule } from '../../components/member/member.module';
import { ProposalCardModule } from '../../components/proposal/components/proposal-card/proposal-card.module';
import { TruncateModule } from './../../@core/pipes/truncate/truncate.module';
import { TabsModule } from './../../components/tabs/tabs.module';
import { AwardsPage } from './pages/awards/awards.page';
import { MembersPage } from './pages/members/members.page';
import { OverviewPage } from './pages/overview/overview.page';
import { ProposalsPage } from './pages/proposals/proposals.page';
import { SpacePage } from './pages/space/space.page';
import { TreasuryPage } from './pages/treasury/treasury.page';
import { UpsertPage } from './pages/upsert/upsert.page';
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
    UpsertPage
  ],
  providers: [DataService],
  imports: [
    CommonModule,
    TabsModule,
    InfiniteScrollModule,
    ReactiveFormsModule,
    SpaceRoutingModule,
    TruncateModule,
    MemberModule,
    ProposalCardModule,
    AwardCardModule,
    NzRadioModule,
    NzBadgeModule,
    NzFormModule,
    NzGridModule,
    NzButtonModule,
    NzTypographyModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzUploadModule,
    NzAvatarModule,
    IconModule
  ]
})
export class SpaceModule { }
