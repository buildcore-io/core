import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RelativeTimeModule } from '@core/pipes/relative-time/relative-time.module';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { ProposalVoteActionComponent } from './proposal-vote-action.component';



@NgModule({
  declarations: [
    ProposalVoteActionComponent
  ],
  imports: [
    CommonModule,
    NzAlertModule,
    RelativeTimeModule
  ],
  exports: [
    ProposalVoteActionComponent
  ]
})
export class ProposalVoteActionModule { }
