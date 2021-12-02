import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { IpfsAvatarModule } from "@core/pipes/ipfs-avatar/ipfs-avatar.module";
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { TruncateModule } from '../../../../@core/pipes/truncate/truncate.module';
import { MemberEditDrawerComponent } from './member-edit-drawer.component';

@NgModule({
  exports: [
    MemberEditDrawerComponent
  ],
  declarations: [
    MemberEditDrawerComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    TruncateModule,
    IpfsAvatarModule,
    NzAvatarModule,
    NzAvatarModule,
    NzIconModule,
    NzTagModule,
    NzInputModule,
    NzCardModule,
    NzUploadModule,
    NzFormModule,
    NzButtonModule,
    NzDrawerModule,
    IconModule
  ]
})

export class MemberEditDrawerModule { }
