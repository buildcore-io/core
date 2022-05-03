import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';

@Component({
  selector: 'wen-overview',
  templateUrl: './overview.page.html',
  styleUrls: ['./overview.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewPage {

  constructor(
    public deviceService: DeviceService
  ) {}
}
