import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ProposalStatusComponent } from './proposal-status.component';

@NgModule({
  exports: [
    ProposalStatusComponent,
  ],
  declarations: [
    ProposalStatusComponent,
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    NzTagModule,
    NzIconModule,
    NzProgressModule,
  ],
})

export class ProposalStatusModule {
}
