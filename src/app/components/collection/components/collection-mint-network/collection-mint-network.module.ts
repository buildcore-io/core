import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { ModalDrawerModule } from '@components/modal-drawer/modal-drawer.module';
import { TermsAndConditionsModule } from '@components/terms-and-conditions/terms-and-conditions.module';
import { WalletDeeplinkModule } from '@components/wallet-deeplink/wallet-deeplink.module';
import { CountdownTimeModule } from '@core/pipes/countdown-time/countdown-time.module';
import { TimeModule } from '@core/pipes/time/time.module';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { CollectionMintNetworkComponent } from './collection-mint-network.component';


@NgModule({
  declarations: [
    CollectionMintNetworkComponent
  ],
  imports: [
    CommonModule,
    ModalDrawerModule,
    NzButtonModule,
    IconModule,
    WalletDeeplinkModule,
    TermsAndConditionsModule,
    NzAlertModule,
    CountdownTimeModule,
    TimeModule
  ],
  exports: [
    CollectionMintNetworkComponent
  ]
})
export class CollectionMintNetworkModule { }
