import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BadgeModule } from '@components/badge/badge.module';
import { CollectionStatusModule } from '@components/collection/components/collection-status/collection-status.module';
import { DrawerToggleModule } from '@components/drawer-toggle/drawer-toggle.module';
import { IconModule } from '@components/icon/icon.module';
import { IotaInputModule } from '@components/iota-input/iota-input.module';
import { NftCardModule } from '@components/nft/components/nft-card/nft-card.module';
import { RadioModule } from '@components/radio/radio.module';
import { SelectSpaceModule } from '@components/space/components/select-space/select-space.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { IpfsBadgeModule } from '@core/pipes/ipfs-badge/ipfs-badge.module';
import { MarkDownModule } from '@core/pipes/markdown/markdown.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { FilterService } from '@pages/market/services/filter.service';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { CollectionRoutingModule } from './collection-routing.module';
import { CollectionAboutComponent } from './pages/collection/collection-about/collection-about.component';
import { CollectionPage } from './pages/collection/collection.page';
import { UpsertPage } from './pages/upsert/upsert.page';
import { DataService } from './services/data.service';


@NgModule({
  declarations: [
    CollectionPage,
    UpsertPage,
    CollectionAboutComponent
  ],
  imports: [
    CommonModule,
    CollectionRoutingModule,
    LayoutModule,
    NzDatePickerModule,
    IpfsAvatarModule,
    CollectionStatusModule,
    NzButtonModule,
    FormsModule,
    NzInputNumberModule,
    SelectSpaceModule,
    ReactiveFormsModule,
    NzCardModule,
    MarkDownModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    TruncateModule,
    IconModule,
    NzUploadModule,
    NzSelectModule,
    RadioModule,
    NzRadioModule,
    NzIconModule,
    NzAvatarModule,
    BadgeModule,
    NzDrawerModule,
    IconModule,
    DrawerToggleModule,
    NzTagModule,
    NzSkeletonModule,
    NftCardModule,
    InfiniteScrollModule,
    NzToolTipModule,
    NzCheckboxModule,
    IpfsBadgeModule,
    IotaInputModule
  ],
  providers: [
    DataService,
    FilterService
  ]
})
export class CollectionModule { }
