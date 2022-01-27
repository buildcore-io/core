import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MemberReputationModalModule } from '../member-reputation-modal/member-reputation-modal.module';
import { MemberSpaceRowComponent } from './member-space-row.component';



@NgModule({
  declarations: [
    MemberSpaceRowComponent
  ],
  imports: [
    CommonModule,
    IconModule,
    NzTagModule,
    MemberReputationModalModule,
    NzAvatarModule
  ],
  exports: [
    MemberSpaceRowComponent
  ]
})
export class MemberSpaceRowModule { }
