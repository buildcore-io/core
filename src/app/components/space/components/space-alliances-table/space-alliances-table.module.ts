import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { SpaceAlliancesTableComponent } from './space-alliances-table.component';



@NgModule({
  declarations: [
    SpaceAlliancesTableComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    IconModule
  ],
  exports: [
    SpaceAlliancesTableComponent
  ]
})
export class SpaceAlliancesTableModule { }
