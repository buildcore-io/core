import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { UserRoutingModule } from './member-routing.module';
import { ActivityPage } from './pages/activity/activity.page';
import { AwardsPage } from './pages/awards/awards.page';
import { BadgesPage } from './pages/badges/badges.page';
import { MemberPage } from './pages/member/member.page';
import { YieldPage } from './pages/yield/yield.page';

@NgModule({
  declarations: [MemberPage, ActivityPage, AwardsPage, BadgesPage, YieldPage],
  imports: [
    CommonModule, 
    UserRoutingModule,
    NzButtonModule,
    NzAvatarModule,
    NzCardModule,
    NzGridModule,
    NzInputModule,
    NzMenuModule,
    NzTypographyModule,
    NzUploadModule,
    NzIconModule,
    NzStatisticModule,
    NzDrawerModule,
    NzFormModule
  ],
})
export class MemberModule {

}
