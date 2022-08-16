import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UnknownIfInfinityModule } from '@core/pipes/unknown-if-infinity/unknown-if-infinity.module';
import { UnknownIfZeroModule } from '@core/pipes/unknown-if-zero/unknown-if-zero.module';
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
    UnknownIfZeroModule,
    UnknownIfInfinityModule
  ],
  exports: [
    TokenAllTokenRowComponent
  ]
})
export class TokenAllTokenRowModule { }
