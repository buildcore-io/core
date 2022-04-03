import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { MemberAlliancesTableModule } from '../member-alliances-table/member-alliances-table.module';
import { MemberReputationModalComponent } from './member-reputation-modal.component';


@NgModule({
  declarations: [
    MemberReputationModalComponent
  ],
  imports: [
    CommonModule,
    NzTableModule,
    NzAvatarModule,
    IpfsAvatarModule,
    NzTypographyModule,
    NzModalModule,
    MemberAlliancesTableModule
  ],
  exports: [
    MemberReputationModalComponent
  ]
})
export class MemberReputationModalModule { }
