import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DescriptionModule } from '@components/description/description.module';
import { IconModule } from '@components/icon/icon.module';
import { ModalDrawerModule } from '@components/modal-drawer/modal-drawer.module';
import { RadioModule } from '@components/radio/radio.module';
import { FormatTokenModule } from '@core/pipes/formatToken/format-token.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { SpaceRewardScheduleComponent } from './space-reward-schedule.component';

@NgModule({
  declarations: [SpaceRewardScheduleComponent],
  imports: [
    CommonModule,
    ModalDrawerModule,
    IconModule,
    NzIconModule,
    FormatTokenModule,
    NzFormModule,
    NzDatePickerModule,
    NzSelectModule,
    FormsModule,
    NzTableModule,
    NzCardModule,
    NzTagModule,
    NzUploadModule,
    ReactiveFormsModule,
    DescriptionModule,
    NzButtonModule,
    RadioModule,
    NzRadioModule,
  ],
  exports: [SpaceRewardScheduleComponent],
})
export class SpaceRewardScheduleModule {}
