import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { TokenCardComponent } from './token-card.component';


@NgModule({
  declarations: [
    TokenCardComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    NzAvatarModule,
    IconModule,
    NzProgressModule
  ],
  exports: [
    TokenCardComponent
  ]
})
export class TokenCardModule { }
