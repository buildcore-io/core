import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { IOTAAddressComponent } from './iota-address/iota-address.component';
import { SpaceSpecifyAddressComponent } from './space-specify-address.component';



@NgModule({
  declarations: [
    SpaceSpecifyAddressComponent,
    IOTAAddressComponent
  ],
  imports: [
    CommonModule,
    NzDrawerModule,
    NzModalModule,
    IconModule,
    NzButtonModule
  ],
  exports: [
    SpaceSpecifyAddressComponent,
    IOTAAddressComponent
  ]
})
export class SpaceSpecifyAddressModule { }
