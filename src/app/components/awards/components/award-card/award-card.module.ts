import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UiModule } from '@components/ui/ui.module';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TruncateModule } from './../../../../@core/pipes/truncate/truncate.module';
import { DateTagModule } from './../../../../@shell/ui/date-tag/date-tag.module';
import { ParentTitleModule } from './../../../../@shell/ui/parent-title/parent-title.module';
import { AwardsStatusModule } from './../award-status/award-status.module';
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
    ParentTitleModule,
    DateTagModule,
    AwardsStatusModule,
    TruncateModule,
    UiModule,
    NzTagModule
  ]
})

export class AwardsCardModule { }
