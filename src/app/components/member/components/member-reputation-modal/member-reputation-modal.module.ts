import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
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
    NzTypographyModule
  ],
  exports: [
    MemberReputationModalComponent
  ]
})
export class MemberReputationModalModule { }
