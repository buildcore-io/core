import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { SpaceAlliancesTableModule } from '@components/space/components/space-alliances-table/space-alliances-table.module';
import { SpaceNewAllianceModule } from '@components/space/components/space-new-alliance/space-new-alliance.module';
import { SpaceSpecifyAddressModule } from '@components/space/components/space-specify-address/space-specify-address.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MarkDownModule } from '../../../../../@core/pipes/markdown/markdown.module';
import { SpaceAboutComponent } from './space-about.component';



@NgModule({
  declarations: [
    SpaceAboutComponent
  ],
  imports: [
    CommonModule,
    MarkDownModule,
    NzCardModule,
    IconModule,
    NzAvatarModule,
    RouterModule,
    NzTagModule,
    TruncateModule,
    IpfsAvatarModule,
    NzButtonModule,
    NzModalModule,
    NzFormModule,
    NzSelectModule,
    FormsModule,
    ReactiveFormsModule,
    NzInputNumberModule,
    NzNotificationModule,
    SpaceAlliancesTableModule,
    NzDrawerModule,
    SpaceNewAllianceModule,
    SpaceSpecifyAddressModule
  ],
  exports: [
    SpaceAboutComponent
  ]
})
export class SpaceAboutModule { }
