import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NewPage } from './pages/new/new.page';
import { OverviewPage } from './pages/overview/overview.page';
import { ProposalPage } from './pages/proposal/proposal.page';
import { ProposalRoutingModule } from './proposal-routing.module';



@NgModule({
  declarations: [
    ProposalPage,
    OverviewPage,
    NewPage
  ],
  imports: [
    CommonModule,
    ProposalRoutingModule
  ]
})
export class ProposalModule { }
