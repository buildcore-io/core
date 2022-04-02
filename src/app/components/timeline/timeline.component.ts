import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SuccesfullOrdersWithFullHistory } from '@api/nft.api';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsHelper } from '@core/utils/units-helper';
import { Member, Space, Transaction, TransactionType } from '@functions/interfaces/models';
import { FILE_SIZES } from '@functions/interfaces/models/base';
import { Nft } from '@functions/interfaces/models/nft';

export enum TimelineType {
  NFT = 'nft',
  BADGE = 'badge'
}
@Component({
  selector: 'wen-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineComponent {
  @Input() nft?: Nft | null;
  @Input() orders?: SuccesfullOrdersWithFullHistory[] | null;
  @Input() listedBy?: Space | null;
  @Input() badges?: Transaction[] | null;
  @Input() timelineType: string = TimelineType.BADGE;
  @Input() owner?: Member | null;
  public isCollapsed = false;
  public showAll = false;
  public showAllBadges = false;
  public collapsedEventsCount = 2;

  constructor(
    public deviceService: DeviceService,
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

  public getTitle(tt: Transaction): string {
    if (tt.type === TransactionType.BILL_PAYMENT) {
      if (tt.payload.royalty === false) {
        return $localize`Bill (owner)`;
      } else {
        return $localize`Bill (royalty)`;
      }
    } else if (tt.type === TransactionType.CREDIT) {
      return $localize`Credit`;
    } else if (tt.type === TransactionType.PAYMENT) {
      return $localize`Payment`;
    } else {
      return $localize`Order`;
    }
  }

  public getExplorerLink(link: string): string {
    return 'https://thetangle.org/search/' + link;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
