import { CommonModule, PercentPipe } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UnknownIfZeroModule } from '@core/pipes/unknown-if-zero/unknown-if-zero.module';
import { UsdBelowTwoDecimalsModule } from '@core/pipes/usd-below-two-decimals/usd-below-two-decimals.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { TokenAllTokenRowComponent } from './token-all-token-row.component';

@NgModule({
  declarations: [TokenAllTokenRowComponent],
  imports: [
    CommonModule,
    RouterModule,
    NzAvatarModule,
    NzButtonModule,
    NzSkeletonModule,
    UsdBelowTwoDecimalsModule,
    UnknownIfZeroModule,
  ],
  providers: [PercentPipe],
  exports: [TokenAllTokenRowComponent],
})
export class TokenAllTokenRowModule {}
