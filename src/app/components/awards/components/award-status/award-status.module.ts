import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AwardStatusComponent } from './award-status.component';
import { statusPrintPipe } from './award-status.pipe';

@NgModule({
  exports: [
    AwardStatusComponent
  ],
  declarations: [
    AwardStatusComponent,
    statusPrintPipe
  ],
  imports: [
    CommonModule,
    NzTagModule
  ]
})

export class AwardsStatusModule { }
