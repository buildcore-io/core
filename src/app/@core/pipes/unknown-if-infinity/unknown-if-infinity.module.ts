import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UnknownIfInfinityPipe } from './unknown-if-infinity.pipe';

@NgModule({
  declarations: [UnknownIfInfinityPipe],
  imports: [CommonModule],
  exports: [UnknownIfInfinityPipe],
})
export class UnknownIfInfinityModule {}
