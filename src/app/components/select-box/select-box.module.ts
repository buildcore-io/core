import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IconModule } from '@components/icon/icon.module';
import { ClickOutsideModule } from '@core/directives/click-outside/click-outside.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { SelectBoxOptionsComponent } from './select-box-options/select-box-options.component';
import { SelectBoxComponent } from './select-box.component';



@NgModule({
  declarations: [
    SelectBoxComponent,
    SelectBoxOptionsComponent
  ],
  imports: [
    CommonModule,
    IconModule,
    NzInputModule,
    FormsModule,
    ReactiveFormsModule,
    ClickOutsideModule,
    NzButtonModule,
    NzDrawerModule,
    NzAvatarModule
  ],
  exports: [
    SelectBoxComponent
  ]
})
export class SelectBoxModule { }
