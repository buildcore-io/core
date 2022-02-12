import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { StripMarkDownModule } from '@core/pipes/strip-markdown/strip-markdown.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NftCardComponent } from './nft-card.component';



@NgModule({
  declarations: [
    NftCardComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    StripMarkDownModule,
    TruncateModule,
    IconModule,
    NzButtonModule
  ],
  exports:[
    NftCardComponent
  ]
})
export class NftCardModule { }
