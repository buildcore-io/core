import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AllianceExtended } from '@api/space.api';
import { AvatarService } from '@core/services/avatar';
import { DeviceService } from '@core/services/device';

@Component({
  selector: 'wen-space-alliances-table',
  templateUrl: './space-alliances-table.component.html',
  styleUrls: ['./space-alliances-table.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceAlliancesTableComponent {
  @Input() alliances: AllianceExtended[] = []
  @Input() size: 'small' | 'large' = 'large';
  @Output() onAllianceEdit = new EventEmitter<AllianceExtended>();

  constructor(
    public deviceService: DeviceService,
    public avatarService: AvatarService
  ) { }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
