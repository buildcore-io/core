import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DrawerToggleModule } from '@components/drawer-toggle/drawer-toggle.module';
import { MemberAboutModule } from '@components/member/components/member-about/member-about.module';
import { MemberSpaceRowModule } from '@components/member/components/member-space-row/member-space-row.module';
import { IpfsAvatarModule } from "@core/pipes/ipfs-avatar/ipfs-avatar.module";
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NgApexchartsModule } from "ng-apexcharts";
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { AwardCardModule } from '../../components/award/components/award-card/award-card.module';
import { TruncateModule } from './../../@core/pipes/truncate/truncate.module';
import { BadgeModule } from './../../components/badge/badge.module';
import { IconModule } from './../../components/icon/icon.module';
import { TabsModule } from './../../components/tabs/tabs.module';
import { UserRoutingModule } from './member-routing.module';
import { ActivityPage } from './pages/activity/activity.page';
import { AwardsPage } from './pages/awards/awards.page';
import { BadgesPage } from './pages/badges/badges.page';
import { MemberPage } from './pages/member/member.page';
import { MemberSpacesComponent } from './pages/spaces/member-spaces.component';
import { DataService } from './services/data.service';

@NgModule({
  declarations: [MemberPage, ActivityPage, AwardsPage, BadgesPage, MemberSpacesComponent],
  providers: [ DataService ],
  imports: [
    CommonModule,
    BadgeModule,
    AwardCardModule,
    TabsModule,
    IpfsAvatarModule,
    MemberAboutModule,
    NgApexchartsModule,
    TruncateModule,
    UserRoutingModule,
    NzTagModule,
    NzButtonModule,
    NzTimelineModule,
    NzAvatarModule,
    NzCardModule,
    NzGridModule,
    NzDrawerModule,
    NzTypographyModule,
    NzToolTipModule,
    NzIconModule,
    IconModule,
    LayoutModule,
    DrawerToggleModule,
    NzCheckboxModule,
    FormsModule,
    ReactiveFormsModule,
    NzInputModule,
    MemberSpaceRowModule
  ],
})
export class MemberModule {

}
