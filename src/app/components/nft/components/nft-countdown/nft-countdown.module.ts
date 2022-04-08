import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { NftCountdownComponent } from './nft-countdown.component';


@NgModule({
  declarations: [
    NftCountdownComponent
  ],
  imports: [
    CommonModule,
    IconModule
  ],
  exports: [
    NftCountdownComponent
  ]
})
export class NftCountdownModule { }
