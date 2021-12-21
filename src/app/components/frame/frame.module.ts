import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SoonaverseFrameComponent } from './soonaverse/soonaverse.component';

@NgModule({
  declarations: [
    SoonaverseFrameComponent
  ],
  exports: [
    SoonaverseFrameComponent
  ],
  imports: [
    CommonModule
  ]
})
export class FrameModule { }