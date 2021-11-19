import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Transaction } from './../../../../../../../functions/interfaces/models/transaction';

@Component({
  selector: 'wen-badge-tile',
  templateUrl: './badge-tile.component.html',
  styleUrls: ['./badge-tile.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BadgeTileComponent {
  @Input() public badge?: Transaction;
}
