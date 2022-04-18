import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { MobileHeaderModule } from '../mobile-header/mobile-header.module';
import { MenuModule } from '../sider/menu/menu.module';
import { ThemeSwitchModule } from '../sider/theme-switch/theme-switch.module';
import { MobileMenuComponent } from './mobile-menu.component';


@NgModule({
  declarations: [
    MobileMenuComponent
  ],
  imports: [
    CommonModule,
    MobileHeaderModule,
    NzDrawerModule,
    NzAvatarModule,
    IconModule,
    TruncateModule,
    IpfsAvatarModule,
    MenuModule,
    ThemeSwitchModule,
    NzIconModule,
    NzToolTipModule
  ],
  exports: [
    MobileMenuComponent
  ]
})
export class MobileMenuModule { }
