import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DescriptionModule } from '@components/description/description.module';
import { IconModule } from '@components/icon/icon.module';
import { ModalDrawerModule } from '@components/modal-drawer/modal-drawer.module';
import { WalletDeeplinkModule } from '@components/wallet-deeplink/wallet-deeplink.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { TokenPurchaseComponent } from './token-purchase.component';


@NgModule({
  declarations: [
    TokenPurchaseComponent
  ],
  imports: [
    CommonModule,
    NzModalModule,
    NzDrawerModule,
    IconModule,
    NzButtonModule,
    NzCheckboxModule,
    NzAvatarModule,
    NzInputModule,
    FormsModule,
    ReactiveFormsModule,
    DescriptionModule,
    ModalDrawerModule,
    WalletDeeplinkModule
  ],
  exports: [
    TokenPurchaseComponent
  ]
})
export class TokenPurchaseModule { }
