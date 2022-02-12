import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { Transaction } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';

@Component({
  selector: 'wen-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineComponent {
  @Input() badges?: Transaction[] | null;
  
  public showAllBadges = false;

  constructor(
    public deviceService: DeviceService
  ) {}

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
