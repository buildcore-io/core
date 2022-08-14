import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
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
    NzButtonModule
  ],
  exports: [
    TokenAllTokenRowComponent
  ]
})
export class TokenAllTokenRowModule { }
