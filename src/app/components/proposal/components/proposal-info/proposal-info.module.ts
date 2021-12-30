import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { NzCardModule } from 'ng-zorro-antd/card';
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
    NzTypographyModule
  ],
  exports: [
    ProposalInfoComponent
  ]
})
export class ProposalInfoModule { }
