import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ModalDrawerModule } from '@components/modal-drawer/modal-drawer.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { TokenTradeDetailModalComponent } from './token-trade-detail-modal.component';


@NgModule({
  declarations: [
    TokenTradeDetailModalComponent
  ],
  imports: [
    CommonModule,
    ModalDrawerModule,
    NzToolTipModule,
    NzAvatarModule,
    RouterModule,
    NzTableModule
  ],
  exports: [
    TokenTradeDetailModalComponent
  ]
})
export class TokenTradeDetailModalModule { }
