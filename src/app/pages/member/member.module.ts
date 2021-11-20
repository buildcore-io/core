import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgApexchartsModule } from "ng-apexcharts";
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { AwardCardModule } from '../../components/award/components/award-card/award-card.module';
import { TruncateModule } from './../../@core/pipes/truncate/truncate.module';
import { BadgeModule } from './../../components/badge/badge.module';
import { MemberEditDrawerModule } from './../../components/member/components/member-edit-drawer/member-edit-drawer.module';
import { MemberTileModule } from './../../components/member/components/tile/member-tile.module';
import { TabsModule } from './../../components/tabs/tabs.module';
import { UserRoutingModule } from './member-routing.module';
import { ActivityPage } from './pages/activity/activity.page';
import { AwardsPage } from './pages/awards/awards.page';
import { BadgesPage } from './pages/badges/badges.page';
import { MemberPage } from './pages/member/member.page';
import { YieldPage } from './pages/yield/yield.page';
import { DataService } from './services/data.service';

@NgModule({
  declarations: [MemberPage, ActivityPage, AwardsPage, BadgesPage, YieldPage],
  providers: [ DataService ],
  imports: [
    CommonModule,
    BadgeModule,
    AwardCardModule,
    TabsModule,
    MemberEditDrawerModule,
    MemberTileModule,
    NgApexchartsModule,
    TruncateModule,
    UserRoutingModule,
    NzButtonModule,
    NzTimelineModule,
    NzAvatarModule,
    NzCardModule,
    NzGridModule,
    NzTypographyModule,
    NzIconModule
  ],
})
export class MemberModule {

}
