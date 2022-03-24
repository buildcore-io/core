import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IconModule } from '@components/icon/icon.module';
import { RadioModule } from '@components/radio/radio.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NftSaleComponent } from './nft-sale.component';
import { NftSaleNotForSaleComponent } from './nft-sale-not-for-sale/nft-sale-not-for-sale.component';
import { NftSaleFixedPriceComponent } from './nft-sale-fixed-price/nft-sale-fixed-price.component';
import { NftSaleAuctionComponent } from './nft-sale-auction/nft-sale-auction.component';



@NgModule({
  declarations: [
    NftSaleComponent,
    NftSaleNotForSaleComponent,
    NftSaleFixedPriceComponent,
    NftSaleAuctionComponent
  ],
  imports: [
    CommonModule,
    NzDrawerModule,
    NzModalModule,
    IconModule,
    NzToolTipModule,
    NzCheckboxModule,
    NzButtonModule,
    NzTagModule,
    NzInputNumberModule,
    NzFormModule,
    FormsModule,
    ReactiveFormsModule,
    NzDatePickerModule,
    RadioModule,
    NzRadioModule,
    NzSelectModule,
    NzIconModule,
    NzCheckboxModule
  ],
  exports: [
    NftSaleComponent
  ]
})
export class NftSaleModule { }
