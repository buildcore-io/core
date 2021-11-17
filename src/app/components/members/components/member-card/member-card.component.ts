import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Member } from '../../../../../../functions/interfaces/models/member';

@Component({
  selector: 'wen-member-card',
  templateUrl: './member-card.component.html',
  styleUrls: ['./member-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberCardComponent {
  @Input() member?: Member;
  @Input() fullWidth?: boolean;
}
