import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Award } from '@functions/interfaces/models';
import { HelperService } from '@pages/award/services/helper.service';

@Component({
  selector: 'wen-award-status',
  templateUrl: './award-status.component.html',
  styleUrls: ['./award-status.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardStatusComponent {
  @Input() award?: Award|null;

  constructor(
    public helper: HelperService
  ) { }
}
