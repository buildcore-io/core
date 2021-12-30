import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { SpaceAboutComponent } from './space-about.component';



@NgModule({
  declarations: [
    SpaceAboutComponent
  ],
  imports: [
    CommonModule,
    NzCardModule,
    IconModule,
    NzAvatarModule,
    RouterModule,
    NzTagModule,
    TruncateModule,
    IpfsAvatarModule,
    NzButtonModule
  ],
  exports: [
    SpaceAboutComponent
  ]
})
export class SpaceAboutModule { }
