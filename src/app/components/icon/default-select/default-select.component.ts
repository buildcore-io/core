import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'wen-icon-default-select',
  templateUrl: './default-select.component.html',
  styleUrls: ['./default-select.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DefaultSelectIconComponent {
  @Input() size = 24;
}
