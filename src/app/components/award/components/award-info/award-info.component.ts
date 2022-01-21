import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DataService } from '@pages/award/services/data.service';
import { FILE_SIZES } from './../../../../../../functions/interfaces/models/base';

@Component({
  selector: 'wen-award-info',
  templateUrl: './award-info.component.html',
  styleUrls: ['./award-info.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardInfoComponent {
  constructor(
    public data: DataService
  ) {}

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
