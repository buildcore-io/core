import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { CountdownTimeModule } from '@core/pipes/countdown-time/countdown-time.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalModule } from 'ng-zorro-antd/modal';
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
    CountdownTimeModule,
    NzButtonModule,
    TruncateModule
  ],
  exports: [
    WalletAddressComponent
  ]
})
export class WalletAddressModule { }
