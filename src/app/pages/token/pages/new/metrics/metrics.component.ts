import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { NewService } from '@pages/token/services/new.service';
import { StepType } from '../new.page';

@Component({
  selector: 'wen-new-metrics',
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewMetricsComponent {
  @Output() wenOnTabChange = new EventEmitter<StepType>();

  constructor(
    public newService: NewService,
    public deviceService: DeviceService
  ) {}
  
  public get stepTypes(): typeof StepType {
    return StepType;
  }

  public getAllocationTitle(index: number): string {
    return index === 1 ? $localize`Token allocation` : ($localize`Allocation` + ` #${index >= 10 ? index : '0' + index}`);
  }

  public getAllocationDescription(index: number): string {
    return index === 1 ?
      $localize`Please make sure that there is one allocation market as Public Sale as this could be later sold on Soonaverse. 
        ou can initiate Public sale once the token is created and approved.` : '';
  }
}
