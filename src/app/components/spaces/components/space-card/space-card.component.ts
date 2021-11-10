import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'wen-space-card',
  templateUrl: './space-card.component.html',
  styleUrls: ['./space-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceCardComponent {
  @Input()
  space = { id: 0, title: '', description: '', members: 0, cover: '', token: '' };
}
