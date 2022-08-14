import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UknownIfZeroModule } from '@core/pipes/uknown-if-zero/uknown-if-zero.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { TokenAllTokenRowComponent } from './token-all-token-row.component';


@NgModule({
  declarations: [
    TokenAllTokenRowComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    NzAvatarModule,
    NzButtonModule,
    UknownIfZeroModule
  ],
  exports: [
    TokenAllTokenRowComponent
  ]
})
export class TokenAllTokenRowModule { }
