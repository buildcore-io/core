import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TruncateModule } from '../../../../@core/pipes/truncate/truncate.module';
import { IconModule } from './../../../../components/icon/icon.module';
import { MemberCardComponent } from './member-card.component';

@NgModule({
  exports: [
    MemberCardComponent
  ],
  declarations: [
    MemberCardComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    TruncateModule,
    NzAvatarModule,
    NzIconModule,
    IconModule,
    NzTagModule
  ]
})

export class MemberCardModule { }
