import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SuccesfullOrdersWithFullHistory } from '@api/nft.api';
import { AvatarService } from '@core/services/avatar';
import { DeviceService } from '@core/services/device';
import { UnitsHelper } from '@core/utils/units-helper';
import { Space } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';

@Component({
  selector: 'wen-timeline-nft',
  templateUrl: './timeline-nft.component.html',
  styleUrls: ['./timeline-nft.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineNftComponent {
  @Input() orders?: SuccesfullOrdersWithFullHistory[] | null;
  @Input() listedBy?: Space | null;

  constructor(
    public deviceService: DeviceService,
    public avatarService: AvatarService
  ) {}

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public formatBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
