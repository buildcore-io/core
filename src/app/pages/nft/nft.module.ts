import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IconModule } from '@components/icon/icon.module';
import { RadioModule } from '@components/radio/radio.module';
import { TabsModule } from '@components/tabs/tabs.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NftRoutingModule } from './nft-routing.module';
import { NewPage } from './pages/new/new.page';
import { NFTPage } from './pages/nft/nft.page';
import { DataService } from './services/data.service';
import { SinglePage } from './pages/single/single.page';
import { MultiplePage } from './pages/multiple/multiple.page';



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
    TabsModule
  ],
  providers: [
    DataService
  ]
})
export class NFTModule { }
