import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { TruncateModule } from '../../../../@core/pipes/truncate/truncate.module';
import { IconModule } from './../../../icon/icon.module';
import { SpaceCardComponent } from './space-card.component';

@NgModule({
  exports: [
    SpaceCardComponent
  ],
  declarations: [
    SpaceCardComponent
  ],
  imports: [
    CommonModule,
    IconModule,
    TruncateModule,
    NzAvatarModule
  ]
})

export class SpaceCardModule { }
