import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TruncateModule } from '../../../../@core/pipes/truncate/truncate.module';
import { DateTagModule } from '../../../date-tag/date-tag.module';
import { ParentTitleModule } from '../../../parent-title/parent-title.module';
import { AwardStatusModule } from '../award-status/award-status.module';
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
    AwardStatusModule,
    TruncateModule,
    NzTagModule
  ]
})

export class AwardCardModule { }
