import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { MemberAlliancesTableModule } from '../member-alliances-table/member-alliances-table.module';
import { MemberReputationDrawerComponent } from './member-reputation-drawer.component';


@NgModule({
  declarations: [
    MemberReputationDrawerComponent
  ],
  imports: [
    CommonModule,
    NzDrawerModule,
    NzAvatarModule,
    IpfsAvatarModule,
    MemberAlliancesTableModule,
    IconModule
  ],
  exports: [
    MemberReputationDrawerComponent
  ]
})
export class MemberReputationDrawerModule { }
