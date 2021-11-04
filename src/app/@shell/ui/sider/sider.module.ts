import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UiModule } from '@components/ui/ui.module';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { MenuModule } from './menu/menu.module';
import { SiderComponent } from './sider.component';
import { ThemeSwitchModule } from './theme-switch/theme-switch.module';

@NgModule({
  declarations: [SiderComponent],
  imports: [
    CommonModule,
    NzLayoutModule,
    NzIconModule,
    NzMenuModule,
    RouterModule,
    UiModule,
    ThemeSwitchModule,
    MenuModule,
  ],
  exports: [SiderComponent]
})
export class SiderModule { }
