import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { IpfsBadgeModule } from '@core/pipes/ipfs-badge/ipfs-badge.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { TimelineNftComponent } from './timeline-nft.component';

@NgModule({
  declarations: [
    TimelineNftComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    NzCardModule,
    NzPopoverModule,
    IconModule,
    IpfsBadgeModule
  ],
  exports: [
    TimelineNftComponent
  ]
})
export class TimelineNftModule { }
