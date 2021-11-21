import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
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
    NzTagModule,
    NzIconModule,
    NzProgressModule
  ]
})

export class ProposalCardModule { }
