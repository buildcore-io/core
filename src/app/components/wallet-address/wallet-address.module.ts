import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { WalletDeeplinkModule } from '@components/wallet-deeplink/wallet-deeplink.module';
import { CountdownTimeModule } from '@core/pipes/countdown-time/countdown-time.module';
import { TimeModule } from '@core/pipes/time/time.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { VerifyAddressComponent } from './verify-address/verify-address.component';
import { WalletAddressComponent } from './wallet-address.component';


@NgModule({
  declarations: [
    WalletAddressComponent,
    VerifyAddressComponent
  ],
  imports: [
    CommonModule,
    NzDrawerModule,
    NzModalModule,
    IconModule,
    CountdownTimeModule,
    NzButtonModule,
    TimeModule,
    NzAlertModule,
    TruncateModule,
    WalletDeeplinkModule
  ],
  exports: [
    WalletAddressComponent
  ]
})
export class WalletAddressModule { }
