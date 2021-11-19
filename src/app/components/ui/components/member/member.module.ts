import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { MemberEditDrawerComponent } from './member-edit-drawer/member-edit-drawer.component';
import { MemberTileComponent } from './tile/member-tile.component';



@NgModule({
  declarations: [
    MemberTileComponent,
    MemberEditDrawerComponent
  ],
  exports: [
    MemberTileComponent,
    MemberEditDrawerComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzInputModule,
    NzCardModule,
    NzStatisticModule,
    NzUploadModule,
    NzFormModule,
    NzButtonModule,
    NzDrawerModule
  ]
})
export class MemberModule { }
