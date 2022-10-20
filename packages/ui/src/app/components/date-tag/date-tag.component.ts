import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'wen-date-tag',
  templateUrl: './date-tag.component.html',
  styleUrls: ['./date-tag.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateTagComponent {
  @Input() public date?: Date;
}
