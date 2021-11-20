import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AwardStatusComponent } from './award-status.component';
import { AwardStatusPrintPipe } from './award-status.pipe';

@NgModule({
  exports: [
    AwardStatusComponent
  ],
  declarations: [
    AwardStatusComponent,
    AwardStatusPrintPipe
  ],
  imports: [
    CommonModule,
    NzTagModule
  ]
})

export class AwardStatusModule { }
