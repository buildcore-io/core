import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { IconModule } from './../../../components/icon/icon.module';
import { MenuModule } from './menu/menu.module';
import { SiderComponent } from './sider.component';
import { ThemeSwitchModule } from './theme-switch/theme-switch.module';

@NgModule({
  declarations: [SiderComponent],
  imports: [
    CommonModule,
    IconModule,
    NzLayoutModule,
    NzIconModule,
    NzMenuModule,
    RouterModule,
    ThemeSwitchModule,
    MenuModule,
  ],
  exports: [SiderComponent]
})
export class SiderModule { }
