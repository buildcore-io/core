import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
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
    NzAvatarModule,
    TruncateModule
  ],
  exports: [
    MemberAlliancesTableComponent
  ]
})
export class MemberAlliancesTableModule { }
