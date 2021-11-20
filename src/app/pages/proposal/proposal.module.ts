import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TabsModule } from "@components/tabs/tabs.module";
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { MarkDownModule } from './../../@core/pipes/markdown/markdown.module';
import { TruncateModule } from './../../@core/pipes/truncate/truncate.module';
import { NewPage } from './pages/new/new.page';
import { OverviewPage } from './pages/overview/overview.page';
import { ProposalPage } from './pages/proposal/proposal.page';
import { ProposalRoutingModule } from './proposal-routing.module';
import { DataService } from './services/data.service';

@NgModule({
  declarations: [
    ProposalPage,
    OverviewPage,
    NewPage
  ],
  providers: [
    DataService
  ],
  imports: [
    CommonModule,
    ProposalRoutingModule,
    ReactiveFormsModule,
    NzSelectModule,
    TabsModule,
    MarkDownModule,
    TruncateModule,
    NzRadioModule,
    NzButtonModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzAvatarModule,
    NzGridModule,
    NzMenuModule,
    NzTypographyModule,
    NzProgressModule,
    NzTableModule,
    NzTagModule,
    NzInputNumberModule,
    NzDividerModule,
    NzDatePickerModule
  ]
})
export class ProposalModule { }
