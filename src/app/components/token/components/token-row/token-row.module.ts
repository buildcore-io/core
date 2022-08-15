import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { UknownIfZeroModule } from '@core/pipes/uknown-if-zero/uknown-if-zero.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TokenRowComponent } from './token-row.component';


@NgModule({
  declarations: [
    TokenRowComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    NzProgressModule,
    NzTagModule,
    IconModule,
    NzButtonModule,
    RouterModule,
    UknownIfZeroModule
  ],
  exports: [
    TokenRowComponent
  ]
})
export class TokenRowModule { }
