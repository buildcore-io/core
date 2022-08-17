import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ModalDrawerModule } from '@components/modal-drawer/modal-drawer.module';
import { TokenTradeDetailModalComponent } from './token-trade-detail-modal.component';


@NgModule({
  declarations: [
    TokenTradeDetailModalComponent
  ],
  imports: [
    CommonModule,
    ModalDrawerModule
  ],
  exports: [
    TokenTradeDetailModalComponent
  ]
})
export class TokenTradeDetailModalModule { }
