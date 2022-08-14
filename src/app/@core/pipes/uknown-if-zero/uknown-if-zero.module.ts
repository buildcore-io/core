import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UknownIfZeroPipe } from './uknown-if-zero.pipe';

@NgModule({
  declarations: [UknownIfZeroPipe],
  imports: [CommonModule],
  exports: [UknownIfZeroPipe],
})
export class UknownIfZeroModule {}
