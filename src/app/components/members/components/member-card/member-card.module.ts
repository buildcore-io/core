import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { UiModule } from '@components/ui/ui.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { MemberCardComponent } from './member-card.component';

@NgModule({
  exports: [
    MemberCardComponent
  ],
  declarations: [
    MemberCardComponent
  ],
  imports: [
    CommonModule,
    NzAvatarModule,
    UiModule,
    NzIconModule,
    NzTagModule
  ]
})

export class MembersCardModule { }
