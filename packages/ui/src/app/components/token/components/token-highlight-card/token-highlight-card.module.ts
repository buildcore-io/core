import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UnknownIfZeroModule } from '@core/pipes/unknown-if-zero/unknown-if-zero.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TokenHighlightCardComponent } from './token-highlight-card.component';

@NgModule({
  declarations: [TokenHighlightCardComponent],
  imports: [
    CommonModule,
    NzCardModule,
    NzAvatarModule,
    NzTableModule,
    RouterModule,
    UnknownIfZeroModule,
  ],
  exports: [TokenHighlightCardComponent],
})
export class TokenHighlightCardModule {}