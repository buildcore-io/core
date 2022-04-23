import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { NewService } from '@pages/token/services/new.service';

@Component({
  selector: 'wen-new-metrics',
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewMetricsComponent {

  constructor(
    public newService: NewService,
    public deviceService: DeviceService
  ) {}
}
