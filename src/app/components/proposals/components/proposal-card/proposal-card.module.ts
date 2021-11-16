import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UiModule } from '@components/ui/ui.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { ProposalCardComponent } from './proposal-card.component';

@NgModule({
  exports: [
    ProposalCardComponent
  ],
  declarations: [
    ProposalCardComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    UiModule
  ]
})

export class ProposalsCardModule { }
