import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AwardType } from '../../../../../../functions/interfaces/models/award';

@Component({
  selector: 'wen-award-status',
  templateUrl: './award-status.component.html',
  styleUrls: ['./award-status.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardStatusComponent {
  @Input() type?: AwardType;
}
