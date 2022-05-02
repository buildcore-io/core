import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { TransactionCardComponent } from './transaction-card.component';


@NgModule({
  declarations: [
    TransactionCardComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule
  ],
  exports: [
    TransactionCardComponent
  ]
})
export class TransactionCardModule { }
