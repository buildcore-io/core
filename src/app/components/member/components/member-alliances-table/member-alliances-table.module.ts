import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTableModule } from 'ng-zorro-antd/table';
import { MemberAlliancesTableComponent } from './member-alliances-table.component';



@NgModule({
  declarations: [
    MemberAlliancesTableComponent
  ],
  imports: [
    CommonModule,
    NzTableModule,
    NzAvatarModule
  ],
  exports: [
    MemberAlliancesTableComponent
  ]
})
export class MemberAlliancesTableModule { }
