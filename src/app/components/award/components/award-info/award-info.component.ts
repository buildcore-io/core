import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DataService } from '@pages/award/services/data.service';
import { FILE_SIZES } from './../../../../../../functions/interfaces/models/base';

@Component({
  selector: 'wen-award-info',
  templateUrl: './award-info.component.html',
  styleUrls: ['./award-info.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardInfoComponent {
  @Input() data?: DataService;
  @Input() trackByUid: (index: number, item: any) => number = (index: number, item: any) => index;

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }
}
