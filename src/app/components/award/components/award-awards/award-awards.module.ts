import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IpfsBadgeModule } from '@core/pipes/ipfs-badge/ipfs-badge.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AwardAwardsComponent } from './award-awards.component';


@NgModule({
  declarations: [
    AwardAwardsComponent,
  ],
  imports: [
    CommonModule,
    NzCardModule,
    NzAvatarModule,
    IpfsBadgeModule,
    NzTagModule,
  ],
  exports: [
    AwardAwardsComponent,
  ],
})
export class AwardAwardsModule {
}
