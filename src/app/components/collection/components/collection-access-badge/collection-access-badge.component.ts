import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Access } from '@functions/interfaces/models/base';

@Component({
  selector: 'wen-collection-access-badge',
  templateUrl: './collection-access-badge.component.html',
  styleUrls: ['./collection-access-badge.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccessBadgeComponent {
  @Input() type!: Access;

  public get accessTypes(): typeof Access {
    return Access;
  }
}
