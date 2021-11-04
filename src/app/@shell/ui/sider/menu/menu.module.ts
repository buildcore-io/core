import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { MenuItemDirective } from './menu-item.directive';
import { MenuComponent } from './menu.component';

@NgModule({
  declarations: [MenuComponent, MenuItemDirective],
  imports: [
    CommonModule,
    RouterModule,
    NzMenuModule,
  ],
  exports: [MenuComponent]
})

export class MenuModule { }
