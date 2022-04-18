import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SelectSpaceModule } from '@components/space/components/select-space/select-space.module';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { SpaceNewAllianceComponent } from './space-new-alliance.component';


@NgModule({
  declarations: [
    SpaceNewAllianceComponent
  ],
  imports: [
    CommonModule,
    NzFormModule,
    NzSelectModule,
    NzAvatarModule,
    NzInputNumberModule,
    FormsModule,
    ReactiveFormsModule,
    SelectSpaceModule,
    NzButtonModule,
    NzToolTipModule,
    NzIconModule
  ],
  exports: [
    SpaceNewAllianceComponent
  ]
})
export class SpaceNewAllianceModule { }
