import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { SiderComponent } from './sider.component';
import { ThemeSwitchComponent } from './theme-switch/theme-switch.component';

@NgModule({
  declarations: [SiderComponent, ThemeSwitchComponent],
  imports: [
    CommonModule,
    NzLayoutModule,
    NzIconModule
  ],
  exports: [SiderComponent]
})
export class SiderModule {}
