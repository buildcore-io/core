import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { BadgeTileComponent } from './badge-tile/badge-tile.component';



@NgModule({
  declarations: [
    BadgeTileComponent
  ],
  exports: [
    BadgeTileComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    NzCardModule,
  ]
})
export class BadgeModule { }
