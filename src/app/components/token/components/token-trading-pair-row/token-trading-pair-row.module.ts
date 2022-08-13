import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { TokenTradingPairRowComponent } from './token-trading-pair-row.component';


@NgModule({
  declarations: [
    TokenTradingPairRowComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    RouterModule,
    IconModule,
    NzButtonModule
  ],
  exports: [
    TokenTradingPairRowComponent
  ]
})
export class TokenTradingPairRowModule { }
