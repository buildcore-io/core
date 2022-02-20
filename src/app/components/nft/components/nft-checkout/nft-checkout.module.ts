import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { CountdownTimeModule } from '@core/pipes/countdown-time/countdown-time.module';
import { TimeModule } from '@core/pipes/time/time.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzNotificationModule } from 'ng-zorro-antd/notification';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NftCheckoutComponent } from './nft-checkout.component';



@NgModule({
  declarations: [
    NftCheckoutComponent
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
    NzNotificationModule 
  ],
  exports: [
    NftCheckoutComponent
  ]
})
export class NftCheckoutModule { }
