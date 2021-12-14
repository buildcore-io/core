import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AwardCardModule } from "@components/award/components/award-card/award-card.module";
import { IconModule } from '@components/icon/icon.module';
import { RadioModule } from '@components/radio/radio.module';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { MemberModule } from '../../components/member/member.module';
import { ProposalCardModule } from '../../components/proposal/components/proposal-card/proposal-card.module';
import { IpfsAvatarModule } from './../../@core/pipes/ipfs-avatar/ipfs-avatar.module';
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
    IpfsAvatarModule,
    ProposalCardModule,
    AwardCardModule,
    IconModule,
    NzTagModule,
    NzRadioModule,
    NzBadgeModule,
    NzDropDownModule,
    NzFormModule,
    NzGridModule,
    NzButtonModule,
    NzTypographyModule,
    NzSkeletonModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    NzTagModule,
    NzAlertModule,
    NzUploadModule,
    NzAvatarModule,
    NzToolTipModule,
    IconModule,
    RadioModule
  ]
})
export class SpaceModule { }
