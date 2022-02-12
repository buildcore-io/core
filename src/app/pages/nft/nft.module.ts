import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IconModule } from '@components/icon/icon.module';
import { NftCardModule } from '@components/nft/components/nft-card/nft-card.module';
import { RadioModule } from '@components/radio/radio.module';
import { TabsModule } from '@components/tabs/tabs.module';
import { TimelineModule } from '@components/timeline/timeline.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NftRoutingModule } from './nft-routing.module';
import { MultiplePage } from './pages/multiple/multiple.page';
import { NewPage } from './pages/new/new.page';
import { NFTPage } from './pages/nft/nft.page';
import { SinglePage } from './pages/single/single.page';
import { DataService } from './services/data.service';



@NgModule({
  declarations: [
    NFTPage,
    NewPage,
    SinglePage,
    MultiplePage
  ],
  imports: [
    CommonModule,
    NftRoutingModule,
    LayoutModule,
    NzButtonModule,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzFormModule,
    NzInputNumberModule,
    IconModule,
    NzUploadModule,
    NzDatePickerModule,
    RadioModule,
    NzIconModule,
    NzInputModule,
    NzRadioModule,
    NzSelectModule,
    TabsModule,
    NzTagModule,
    NzAvatarModule,
    TimelineModule,
    NzToolTipModule,
    NzSkeletonModule,
    NftCardModule
  ],
  providers: [
    DataService
  ]
})
export class NFTModule { }
