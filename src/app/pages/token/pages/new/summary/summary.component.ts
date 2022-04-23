import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { NewService } from '@pages/token/services/new.service';

@Component({
  selector: 'wen-new-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewSummaryComponent {

  constructor(
    public newService: NewService,
    public deviceService: DeviceService
  ) {}
}
