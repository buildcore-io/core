import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { MemberAlliancesTableComponent } from './member-alliances-table.component';



@NgModule({
  declarations: [
    MemberAlliancesTableComponent
  ],
  imports: [
    CommonModule,
    NzTableModule
  ],
  exports: [
    MemberAlliancesTableComponent
  ]
})
export class MemberAlliancesTableModule { }
