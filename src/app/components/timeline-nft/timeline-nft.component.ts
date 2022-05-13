import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SuccesfullOrdersWithFullHistory } from '@api/nft.api';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { TransactionService } from '@core/services/transaction';
import { UnitsHelper } from '@core/utils/units-helper';
import { Space } from '@functions/interfaces/models';
import { FILE_SIZES } from '@functions/interfaces/models/base';
import { Nft } from '@functions/interfaces/models/nft';
import { DataService } from '@pages/nft/services/data.service';

@Component({
  selector: 'wen-timeline-nft',
  templateUrl: './timeline-nft.component.html',
  styleUrls: ['./timeline-nft.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineNftComponent {
  @Input() nft?: Nft | null;
  @Input() orders?: SuccesfullOrdersWithFullHistory[] | null;
  @Input() listedBy?: Space | null;
  public isCollapsed = false;
  public showAll = false;
  public collapsedEventsCount = 2;

  constructor(
    public deviceService: DeviceService,
    public data: DataService,
    public transactionService: TransactionService,
    public previewImageService: PreviewImageService
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public formatBest(amount?: number | null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }

  public trackByUid(index: number, item: any) {
    return item.uid;
  }
}
