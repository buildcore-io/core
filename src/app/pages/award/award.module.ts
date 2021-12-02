import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { IconModule } from '@components/icon/icon.module';
import { MemberCardModule } from '@components/member/components/member-card/member-card.module';
import { IpfsAvatarModule } from "@core/pipes/ipfs-avatar/ipfs-avatar.module";
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { TruncateModule } from './../../@core/pipes/truncate/truncate.module';
import { TabsModule } from './../../components/tabs/tabs.module';
import { AwardRoutingModule } from './award-routing.module';
import { AwardPage } from './pages/award/award.page';
import { NewPage } from './pages/new/new.page';
import { OverviewPage } from './pages/overview/overview.page';
import { ParticipantsPage } from './pages/participants/participants.page';
import { DataService } from './services/data.service';


@NgModule({
  declarations: [
    NewPage,
    AwardPage,
    OverviewPage,
    ParticipantsPage
  ],
  providers: [DataService],
  imports: [
    CommonModule,
    TabsModule,
    TruncateModule,
    AwardRoutingModule,
    IpfsAvatarModule,
    ReactiveFormsModule,
    MemberCardModule,
    NzButtonModule,
    NzSelectModule,
    NzRadioModule,
    NzCardModule,
    NzIconModule,
    NzInputModule,
    NzAvatarModule,
    NzGridModule,
    NzMenuModule,
    NzTypographyModule,
    NzTagModule,
    NzFormModule,
    NzModalModule,
    NzUploadModule,
    NzInputNumberModule,
    NzToolTipModule,
    NzDatePickerModule,
    IconModule
  ]
})
export class AwardModule { }
