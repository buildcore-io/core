import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IconModule } from '@components/icon/icon.module';
import { ModalDrawerModule } from '@components/modal-drawer/modal-drawer.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { BadgeComponent } from './components/badge/badge.component';
import { ModalComponent } from './components/modal/modal.component';
import { WidgetComponent } from './components/widget/widget.component';

@NgModule({
  declarations: [WidgetComponent, ModalComponent, BadgeComponent],
  imports: [
    CommonModule,
    NzCardModule,
    NzAvatarModule,
    IconModule,
    NzButtonModule,
    NzBadgeModule,
    NzTableModule,
    ModalDrawerModule,
  ],
  exports: [WidgetComponent, ModalComponent, BadgeComponent],
})
export class AuditOneModule {}
