import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IpfsAvatarModule } from "@core/pipes/ipfs-avatar/ipfs-avatar.module";
import { IpfsBadgeModule } from '@core/pipes/ipfs-badge/ipfs-badge.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { TruncateModule } from '../../../../@core/pipes/truncate/truncate.module';
import { MemberReputationDrawerModule } from '../member-reputation-drawer/member-reputation-drawer.module';
import { MemberReputationModalModule } from '../member-reputation-modal/member-reputation-modal.module';
import { IconModule } from './../../../../components/icon/icon.module';
import { MemberCardComponent } from './member-card.component';

@NgModule({
  exports: [
    MemberCardComponent
  ],
  declarations: [
    MemberCardComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    NzToolTipModule,
    IpfsAvatarModule,
    IpfsBadgeModule,
    TruncateModule,
    NzAvatarModule,
    NzIconModule,
    IconModule,
    NzTagModule,
    MemberReputationModalModule,
    MemberReputationDrawerModule
  ]
})

export class MemberCardModule { }
