import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconModule } from '@components/icon/icon.module';
import { ClickOutsideModule } from '@core/directives/click-outside/click-outside.module';
import { NzInputModule } from 'ng-zorro-antd/input';
import { SelectBoxComponent } from './select-box.component';



@NgModule({
  declarations: [
    SelectBoxComponent
  ],
  imports: [
    CommonModule,
    IconModule,
    NzInputModule,
    FormsModule,
    ClickOutsideModule
  ],
  exports: [
    SelectBoxComponent
  ]
})
export class SelectBoxModule { }
