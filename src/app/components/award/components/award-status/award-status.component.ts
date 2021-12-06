import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Award } from 'functions/interfaces/models';

@Component({
  selector: 'wen-award-status',
  templateUrl: './award-status.component.html',
  styleUrls: ['./award-status.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardStatusComponent {
  @Input() award?: Award|null;
  public isCompleted(award: Award|undefined|null): boolean {
    if (!award) {
      return false;
    }
    return (award.issued >= award.badge.count) && award.approved;
  }
}
