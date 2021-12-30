import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ProposalInfoComponent } from './proposal-info.component';



@NgModule({
  declarations: [
    ProposalInfoComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    ProposalInfoComponent
  ]
})
export class ProposalInfoModule { }
