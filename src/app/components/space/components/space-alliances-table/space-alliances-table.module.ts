import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTableModule } from 'ng-zorro-antd/table';
import { SpaceAlliancesTableComponent } from './space-alliances-table.component';


@NgModule({
  declarations: [
    SpaceAlliancesTableComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    IconModule,
    NzTableModule,
    RouterModule
  ],
  exports: [
    SpaceAlliancesTableComponent
  ]
})
export class SpaceAlliancesTableModule { }
