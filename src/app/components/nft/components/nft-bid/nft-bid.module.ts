import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { CountdownTimeModule } from '@core/pipes/countdown-time/countdown-time.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { RelativeTimeModule } from '@core/pipes/relative-time/relative-time.module';
import { TimeModule } from '@core/pipes/time/time.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NftCountdownModule } from '../nft-countdown/nft-countdown.module';
import { NftBidComponent } from './nft-bid.component';


@NgModule({
  declarations: [
    NftBidComponent
  ],
  imports: [
    RouterModule,
    CommonModule,
    NzDrawerModule,
    NzModalModule,
    IconModule,
    TimeModule,
    NzToolTipModule,
    NzCheckboxModule,
    NzButtonModule,
    CountdownTimeModule,
    NzAlertModule,
    TruncateModule,
    RelativeTimeModule,
    NzNotificationModule,
    NzTableModule,
    NzAvatarModule,
    IpfsAvatarModule,
    NftCountdownModule
  ],
  exports: [
    NftBidComponent
  ]
})
export class NftBidModule { }
