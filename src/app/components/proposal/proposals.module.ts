import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ProposalCardModule } from './components/proposal-card/proposal-card.module';

@NgModule({
  exports: [
    ProposalCardModule,
  ],
  imports: [
    CommonModule,
  ]
})

export class ProposalModule { }
