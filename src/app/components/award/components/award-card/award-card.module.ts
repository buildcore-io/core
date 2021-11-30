import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { TruncateModule } from '../../../../@core/pipes/truncate/truncate.module';
import { DateTagModule } from '../../../date-tag/date-tag.module';
import { ParentTitleModule } from '../../../parent-title/parent-title.module';
import { AwardStatusModule } from '../award-status/award-status.module';
import { IconModule } from './../../../../components/icon/icon.module';
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
    NzTypographyModule,
    NzAvatarModule,
    NzIconModule,
    NzToolTipModule,
    IconModule,
    TruncateModule,
    NzTagModule
  ]
})

export class AwardCardModule { }
