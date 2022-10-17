import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzCardModule } from 'ng-zorro-antd/card';
import { SwapPage } from './pages/market/swap.page';
import { SwapRoutingModule } from './swap-routing.module';

@NgModule({
  declarations: [
    SwapPage,

  ],
  imports: [
    CommonModule,
    SwapRoutingModule,
    NzCardModule,
    RouterModule,
    LayoutModule
  ],
  providers: []
})
export class SwapModule { }
