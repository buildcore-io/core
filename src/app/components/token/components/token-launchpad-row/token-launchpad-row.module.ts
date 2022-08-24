import { CommonModule, PercentPipe } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TokenLaunchpadRowComponent } from './token-launchpad-row.component';


@NgModule({
  declarations: [
    TokenLaunchpadRowComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    NzProgressModule,
    NzButtonModule,
    NzTagModule,
    RouterModule
  ],
  providers: [
    PercentPipe
  ],
  exports: [
    TokenLaunchpadRowComponent
  ]
})
export class TokenLaunchpadRowModule { }
