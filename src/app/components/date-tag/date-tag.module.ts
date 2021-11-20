import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DateTagComponent } from './date-tag.component';

@NgModule({
  declarations: [DateTagComponent],
  imports: [CommonModule, NzAvatarModule, NzTagModule],
  exports: [DateTagComponent],
})
export class DateTagModule {}
