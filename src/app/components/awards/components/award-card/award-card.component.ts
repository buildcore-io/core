import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Award } from '../../../../../../functions/interfaces/models/award';

@Component({
  selector: 'wen-award-card',
  templateUrl: './award-card.component.html',
  styleUrls: ['./award-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardCardComponent {
  @Input() award?: Award;
  @Input() fullWidth?: boolean;
}
