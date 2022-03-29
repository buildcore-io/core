import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CollectionAccess } from '@functions/interfaces/models';

@Component({
  selector: 'wen-collection-access-badge',
  templateUrl: './collection-access-badge.component.html',
  styleUrls: ['./collection-access-badge.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionAccessBadgeComponent {
  @Input() type!: CollectionAccess;

  public get accessTypes(): typeof CollectionAccess {
    return CollectionAccess;
  }
}
