import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FileApi } from '@api/file.api';
import { AllianceExtended } from '@api/space.api';
import { DeviceService } from '@core/services/device';
import { FILE_SIZES } from 'functions/interfaces/models/base';

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
    public deviceService: DeviceService
  ) { }

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
  }
}
