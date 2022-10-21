import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DescriptionModule } from '@components/description/description.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { AwardInfoComponent } from './award-info.component';


@NgModule({
  declarations: [
    AwardInfoComponent,
  ],
  imports: [
    CommonModule,
    NzButtonModule,
    NzAvatarModule,
    NzCardModule,
    RouterModule,
    TruncateModule,
    IpfsAvatarModule,
    DescriptionModule,
  ],
  exports: [
    AwardInfoComponent,
  ],
})
export class AwardInfoModule {
}
