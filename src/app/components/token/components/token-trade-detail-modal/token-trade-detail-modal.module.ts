import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ModalDrawerModule } from '@components/modal-drawer/modal-drawer.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { TokenTradeDetailModalComponent } from './token-trade-detail-modal.component';


@NgModule({
  declarations: [
    TokenTradeDetailModalComponent
  ],
  imports: [
    CommonModule,
    ModalDrawerModule,
    NzAvatarModule
  ],
  exports: [
    TokenTradeDetailModalComponent
  ]
})
export class TokenTradeDetailModalModule { }
