import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormatTokenPipe } from './format-token.pipe';

@NgModule({
  declarations: [FormatTokenPipe],
  imports: [CommonModule],
  exports: [FormatTokenPipe],
})
export class FormatTokenModule {}
