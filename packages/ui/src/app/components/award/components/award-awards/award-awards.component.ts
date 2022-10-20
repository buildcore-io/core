import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DataService } from '@pages/award/services/data.service';
import { HelperService } from '@pages/award/services/helper.service';
import { FILE_SIZES } from '@soon/interfaces';

@Component({
  selector: 'wen-award-awards',
  templateUrl: './award-awards.component.html',
  styleUrls: ['./award-awards.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AwardAwardsComponent {
  constructor(public data: DataService, public helper: HelperService) {}

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }
}
