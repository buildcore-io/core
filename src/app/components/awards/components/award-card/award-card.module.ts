import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UiModule } from '@components/ui/ui.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { AwardCardComponent } from './award-card.component';

@NgModule({
  exports: [
    AwardCardComponent
  ],
  declarations: [
    AwardCardComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    UiModule
  ]
})

export class AwardsCardModule { }
