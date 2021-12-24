import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { IpfsAvatarModule } from '@core/pipes/ipfs-avatar/ipfs-avatar.module';
import { TruncateModule } from '@core/pipes/truncate/truncate.module';
import { MenuModule } from '@shell/ui/sider/menu/menu.module';
import { ThemeSwitchModule } from '@shell/ui/sider/theme-switch/theme-switch.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { MobileMenuComponent } from './mobile-menu.component';


@NgModule({
  declarations: [MobileMenuComponent],
  imports: [
    CommonModule,
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
  exports: [MobileMenuComponent]
})
export class MobileMenuModule { }
