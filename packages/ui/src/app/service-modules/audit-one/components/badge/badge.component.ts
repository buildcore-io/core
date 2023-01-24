import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'wen-audit-one-badge',
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  @Input() public entity?: string;
}
