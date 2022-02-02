import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NftRoutingModule } from './nft-routing.module';
import { NewPage } from './pages/new/new.page';
import { NFTPage } from './pages/nft/nft.page';
import { DataService } from './services/data.service';



@NgModule({
  declarations: [
    NFTPage,
    NewPage
  ],
  imports: [
    CommonModule,
    NftRoutingModule,
    LayoutModule,
    NzButtonModule
  ],
  providers: [
    DataService
  ]
})
export class NFTModule { }
