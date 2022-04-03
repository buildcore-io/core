import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { Transaction } from '@functions/interfaces/models';
import { FILE_SIZES } from '@functions/interfaces/models/base';

@Component({
  selector: 'wen-timeline-badges',
  templateUrl: './timeline-badges.component.html',
  styleUrls: ['./timeline-badges.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineBadgesComponent {
  @Input() badges?: Transaction[] | null;

  public showAllBadges = false;

  constructor(
    public deviceService: DeviceService
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public trackByUid(index: number, item: Transaction) {
    return item.uid;
  }
}
