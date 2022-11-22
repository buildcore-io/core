import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TokenStakeModule } from '@components/token/components/token-stake/token-stake.module';
import { LayoutModule } from '@shell/ui/layout/layout.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzTableModule } from 'ng-zorro-antd/table';
import { StakingPage } from './pages/staking/staking.page';
import { SoonStakingRoutingModule } from './soon-staking-routing.module';

@NgModule({
  declarations: [StakingPage],
  imports: [
    CommonModule,
    SoonStakingRoutingModule,
    NzCardModule,
    RouterModule,
    LayoutModule,
    NzFormModule,
    NzButtonModule,
    FormsModule,
    ReactiveFormsModule,
    NzTableModule,
    TokenStakeModule,
  ],
  providers: [],
})
export class SoonStakingModule {}
