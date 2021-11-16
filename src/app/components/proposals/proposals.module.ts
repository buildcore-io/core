import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ProposalsCardModule } from './components/proposal-card/proposal-card.module';

@NgModule({
  exports: [
    ProposalsCardModule,
  ],
  imports: [
    CommonModule,
  ]
})

export class ProposalsModule { }
