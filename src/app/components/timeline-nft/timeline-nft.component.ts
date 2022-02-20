import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SuccesfullOrdersWithFullHistory } from '@api/nft.api';
import { AvatarService } from '@core/services/avatar';
import { DeviceService } from '@core/services/device';
import { UnitsHelper } from '@core/utils/units-helper';
import { Space, Transaction, TransactionType } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';
import { Nft } from 'functions/interfaces/models/nft';

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

  public getTitle(tt: Transaction): string {
    if (tt.type === TransactionType.BILL_PAYMENT) {
      if (tt.payload.royalty === false) {
        return 'Bill Payment (previous owner)';
      } else {
        return 'Bill Payment (royalty)';
      }
    } else if (tt.type === TransactionType.CREDIT) {
      return 'Credit';
    } else if (tt.type === TransactionType.PAYMENT) {
      return 'Payment';
    } else {
      return 'Order';
    }
  }

  public getExplorerLink(link: string): string {
    return 'https://explorer.iota.org/mainnet/search/' + link;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
