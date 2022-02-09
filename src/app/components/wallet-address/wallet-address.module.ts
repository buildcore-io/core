import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { RelativeTimeModule } from './../../@core/pipes/relative-time/relative-time.module';
import { IOTAAddressComponent } from './iota-address/iota-address.component';
import { WalletAddressComponent } from './wallet-address.component';



@NgModule({
  declarations: [
    WalletAddressComponent,
    IOTAAddressComponent
  ],
  imports: [
    CommonModule,
    NzDrawerModule,
    NzModalModule,
    IconModule,
    RelativeTimeModule,
    NzButtonModule,
    TruncateModule
  ],
  exports: [
    WalletAddressComponent
  ]
})
export class WalletAddressModule { }
