import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { IpfsBadgeModule } from '@core/pipes/ipfs-badge/ipfs-badge.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { TimelineBadgesComponent } from './timeline-badges.component';

@NgModule({
  declarations: [
    TimelineBadgesComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    NzCardModule,
    IconModule,
    IpfsBadgeModule
  ],
  exports: [
    TimelineBadgesComponent
  ]
})
export class TimelineBadgesModule { }
