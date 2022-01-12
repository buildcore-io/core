import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DataService } from '@pages/award/services/data.service';
import { Award } from 'functions/interfaces/models';
import { FILE_SIZES } from './../../../../../../functions/interfaces/models/base';

@Component({
  selector: 'wen-award-awards',
  templateUrl: './award-awards.component.html',
  styleUrls: ['./award-awards.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardAwardsComponent {
  @Input() data?: DataService;
  @Input() getExperiencePointsPerBadge: (award: Award|undefined|null) => number = (award: Award|undefined|null) => 0;

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }
}
