import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UiModule } from '@components/ui/ui.module';
import { NgApexchartsModule } from "ng-apexcharts";
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { TruncateModule } from './../../@core/pipes/truncate/truncate.module';
import { AwardsCardModule } from './../../components/awards/components/award-card/award-card.module';
import { DataService } from './services/data.service';
import { UserRoutingModule } from './member-routing.module';
import { ActivityPage } from './pages/activity/activity.page';
import { AwardsPage } from './pages/awards/awards.page';
import { BadgesPage } from './pages/badges/badges.page';
import { MemberPage } from './pages/member/member.page';
import { YieldPage } from './pages/yield/yield.page';

@NgModule({
  declarations: [MemberPage, ActivityPage, AwardsPage, BadgesPage, YieldPage],
  providers: [ DataService ],
  imports: [
    CommonModule,
    UiModule,
    AwardsCardModule,
    NgApexchartsModule,
    TruncateModule,
    UserRoutingModule,
    NzButtonModule,
    NzAvatarModule,
    NzCardModule,
    NzGridModule,
    NzTypographyModule,
    NzIconModule
  ],
})
export class MemberModule {

}
