import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { SelectBoxComponent } from './select-box.component';



@NgModule({
  declarations: [
    SelectBoxComponent
  ],
  imports: [
    CommonModule,
    IconModule
  ],
  exports: [
    SelectBoxComponent
  ]
})
export class SelectBoxModule { }
