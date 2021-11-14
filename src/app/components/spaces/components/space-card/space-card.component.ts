import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Space } from "functions/interfaces/models";

@Component({
  selector: 'wen-space-card',
  templateUrl: './space-card.component.html',
  styleUrls: ['./space-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceCardComponent {
  @Input() public space?: Space;
}
