import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { TransactionService } from '@core/services/transaction';
import { UnitsHelper } from '@core/utils/units-helper';
import { Transaction, TransactionType } from '@functions/interfaces/models';
import { FileMetedata, FILE_SIZES } from '@functions/interfaces/models/base';

export enum TimelineItemType {
  BADGE = 'Badge',
  LISTED_BY_MEMBER = 'ListedByMember',
  ORDER = 'Order',
  LISTED_BY_SPACE = 'ListedBySpace'
}

export interface BadgeTimelineItemPayload {
  image?: FileMetedata;
  date?: Date;
  name: string;
  xp: string;
}

export interface ListedByMemberTimelineItemPayload {
  image?: FileMetedata;
  date?: Date;
  name: string;
  isAuction: boolean;
}

export interface OrderTimelineItemPayload {
  image?: FileMetedata;
  date?: Date;
  name: string;
  amount: number;
  transactions: Transaction[];
}

export interface ListedBySpaceTimelineItemPayload {
  image?: string;
  date?: Date;
  name: string;
}

export type TimelineItemPayload = BadgeTimelineItemPayload | ListedByMemberTimelineItemPayload | OrderTimelineItemPayload | ListedBySpaceTimelineItemPayload;

export interface TimelineItem {
  type: TimelineItemType;
  payload: TimelineItemPayload;
}

@Component({
  selector: 'wen-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineComponent {
  @Input() 
  set items(value: TimelineItem[]) {
    this._items = value;
  }
  get items(): TimelineItem[] {
    return this._items;
  }
  @Input() isCollapsable = false;
  public showAll = false;
  public collapsedItemsCount = 2;

  private _items: TimelineItem[] = [];

  constructor(
    public deviceService: DeviceService,
    public transactionService: TransactionService,
    public previewImageService: PreviewImageService,
    public cache: CacheService
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public get transactionTypes(): typeof TransactionType {
    return TransactionType;
  }

  public formatBest(amount?: number | null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(Number(amount), 2);
  }

  public trackByUid(index: number, item: any) {
    return item.uid;
  }
  
  public get timelineItemTypes(): typeof TimelineItemType {
    return TimelineItemType;
  }
  
  public getOrdersLength(): number {
    return this.items.filter(item => item.type === TimelineItemType.ORDER).length;
  }

  public castAsBadgePayload(payload: TimelineItemPayload): BadgeTimelineItemPayload {
    return payload as BadgeTimelineItemPayload;
  }

  public castAsListedByMemberPayload(payload: TimelineItemPayload): ListedByMemberTimelineItemPayload {
    return payload as ListedByMemberTimelineItemPayload;
  }

  public castAsOrderPayload(payload: TimelineItemPayload): OrderTimelineItemPayload {
    return payload as OrderTimelineItemPayload;
  }

  public castAsListedBySpacePayload(payload: TimelineItemPayload): ListedBySpaceTimelineItemPayload {
    return payload as ListedBySpaceTimelineItemPayload;
  }
}
