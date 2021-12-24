import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'wen-icon-close',
  templateUrl: './close.component.html',
  styleUrls: ['./close.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CloseIconComponent {
}
