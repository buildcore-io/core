import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { ProposalInfoComponent } from './proposal-info.component';



@NgModule({
  declarations: [
    ProposalInfoComponent
  ],
  imports: [
    CommonModule,
    NzToolTipModule,
    IconModule,
    NzCardModule,
    NzTypographyModule,
    RouterModule,
    TruncateModule,
    NzTableModule
  ],
  exports: [
    ProposalInfoComponent
  ]
})
export class ProposalInfoModule { }
