import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { WalletAddressModule } from '@components/wallet-address/wallet-address.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { BadgeModule } from './../../../../components/badge/badge.module';
import { MemberEditDrawerModule } from './../../../../components/member/components/member-edit-drawer/member-edit-drawer.module';
import { MemberAboutComponent } from './member-about.component';

@NgModule({
  declarations: [MemberAboutComponent],
  imports: [
    CommonModule,
    NzCardModule,
    IconModule,
    NzAvatarModule,
    RouterModule,
    NzTagModule,
    TruncateModule,
    IpfsAvatarModule,
    NzButtonModule,
    WalletAddressModule,
    NzIconModule,
    MemberEditDrawerModule,
    NzDrawerModule,
    NzToolTipModule,
    BadgeModule,
  ],
  exports: [MemberAboutComponent],
})
export class MemberAboutModule {}
