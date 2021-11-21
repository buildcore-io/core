import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthModule } from '@components/auth/auth.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { TruncateModule } from './../../../@core/pipes/truncate/truncate.module';
import { HeaderComponent } from './header.component';

@NgModule({
  declarations: [HeaderComponent],
  imports: [
    CommonModule,
    TruncateModule,
    NzModalModule,
    AuthModule,
    RouterModule,
    NzLayoutModule,
    NzIconModule,
    NzButtonModule,
    NzAvatarModule,
    NzDropDownModule
  ],
  exports: [HeaderComponent],
})
export class HeaderModule { }
