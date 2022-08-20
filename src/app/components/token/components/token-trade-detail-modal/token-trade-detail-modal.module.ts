import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ModalDrawerModule } from '@components/modal-drawer/modal-drawer.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TokenTradeDetailModalComponent } from './token-trade-detail-modal.component';


@NgModule({
  declarations: [
    TokenTradeDetailModalComponent
  ],
  imports: [
    CommonModule,
    ModalDrawerModule,
    NzAvatarModule,
    NzTableModule
  ],
  exports: [
    TokenTradeDetailModalComponent
  ]
})
export class TokenTradeDetailModalModule { }
