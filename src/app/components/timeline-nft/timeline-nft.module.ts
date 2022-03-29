import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { CollapseModule } from '@components/collapse/collapse.module';
import { IconModule } from '@components/icon/icon.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { IpfsBadgeModule } from '@core/pipes/ipfs-badge/ipfs-badge.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { TimelineNftComponent } from './timeline-nft.component';

@NgModule({
  declarations: [
    TimelineNftComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    NzPopoverModule,
    NzCollapseModule,
    IconModule,
    IpfsBadgeModule,
    CollapseModule,
    NzButtonModule,
    IpfsAvatarModule
  ],
  exports: [
    TimelineNftComponent
  ]
})
export class TimelineNftModule { }
