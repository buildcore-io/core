import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UiModule } from '@components/ui/ui.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
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
    NzAvatarModule,
    UiModule
  ]
})

export class SpaceCardModule { }
