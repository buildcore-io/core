import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
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
    ReactiveFormsModule
  ],
  exports: [
    SpaceNewAllianceComponent
  ]
})
export class SpaceNewAllianceModule { }
