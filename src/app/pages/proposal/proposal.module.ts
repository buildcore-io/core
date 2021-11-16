import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
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
    ProposalRoutingModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzDatePickerModule
  ]
})
export class ProposalModule { }
