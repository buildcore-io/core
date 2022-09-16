import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { StepType } from '../new.page';

@Component({
  selector: 'wen-new-introduction',
  templateUrl: './introduction.component.html',
  styleUrls: ['./introduction.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewIntroductionComponent {
  @Output() wenOnTabChange = new EventEmitter<StepType>();

  constructor(
    public deviceService: DeviceService
  ) { }

  public get stepTypes(): typeof StepType {
    return StepType;
  }

  public onFillForm(): void {
    window?.open('https://github.com/soonaverse/soonaverse-dao/issues/new/choose', '_blank');
  }
}
