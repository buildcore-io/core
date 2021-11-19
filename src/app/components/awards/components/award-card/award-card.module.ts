import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UiModule } from '@components/ui/ui.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TruncateModule } from './../../../../@core/pipes/truncate/truncate.module';
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
    TruncateModule,
    UiModule,
    NzTagModule
  ]
})

export class AwardsCardModule { }
