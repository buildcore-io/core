import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '@components/icon/icon.module';
import { MobileHeaderComponent } from './mobile-header.component';



@NgModule({
  declarations: [
    MobileHeaderComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    IconModule
  ],
  exports: [
    MobileHeaderComponent
  ]
})
export class MobileHeaderModule { }
