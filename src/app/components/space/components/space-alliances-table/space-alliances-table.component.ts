import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AllianceExtended } from '@api/space.api';
import { DeviceService } from '@core/services/device';
import { DataService as SpaceDataService } from '@pages/space/services/data.service';

@Component({
  selector: 'wen-space-alliances-table',
  templateUrl: './space-alliances-table.component.html',
  styleUrls: ['./space-alliances-table.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceAlliancesTableComponent {
  @Input() alliances: AllianceExtended[] = []
  @Output() onAllianceEdit = new EventEmitter<AllianceExtended>();

  constructor(
    public deviceService: DeviceService,
    public spaceData: SpaceDataService
  ) { }
}
