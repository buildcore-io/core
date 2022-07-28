import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'wen-icon-globe',
  templateUrl: './globe.component.html',
  styleUrls: ['./globe.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GlobeIconComponent {
  @Input() size = 24;
}
