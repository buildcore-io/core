import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { NewService } from '@pages/token/services/new.service';

@Component({
  selector: 'wen-new-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewOverviewComponent {

  constructor(
    public newService: NewService,
    public deviceService: DeviceService
  ) {}
}
