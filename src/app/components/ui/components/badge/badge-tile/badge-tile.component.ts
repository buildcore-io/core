import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'wen-badge-tile',
  templateUrl: './badge-tile.component.html',
  styleUrls: ['./badge-tile.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BadgeTileComponent {
}
