import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { CollectionAccessBadgeComponent } from './collection-access-badge.component';


@NgModule({
  declarations: [
    CollectionAccessBadgeComponent
  ],
  imports: [
    CommonModule,
    NzToolTipModule,
    IconModule
  ],
  exports: [
    CollectionAccessBadgeComponent
  ]
})
export class CollectionAccessBadgeModule { }
