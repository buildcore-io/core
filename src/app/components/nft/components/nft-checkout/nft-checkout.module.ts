import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NftCheckoutComponent } from './nft-checkout.component';



@NgModule({
  declarations: [
    NftCheckoutComponent
  ],
  imports: [
    CommonModule,
    NzDrawerModule,
    NzModalModule,
    IconModule,
    NzToolTipModule,
    NzCheckboxModule,
    NzButtonModule,
    TruncateModule
  ],
  exports: [
    NftCheckoutComponent
  ]
})
export class NftCheckoutModule { }
