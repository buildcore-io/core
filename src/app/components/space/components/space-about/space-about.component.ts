import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { DataService } from '@pages/space/services/data.service';
import { FILE_SIZES } from './../../../../../../functions/interfaces/models/base';

@Component({
  selector: 'wen-space-about',
  templateUrl: './space-about.component.html',
  styleUrls: ['./space-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceAboutComponent {
  @Input() avatarUrl?: string;
  @Output() onLeave = new EventEmitter<void>();

  constructor(
    public deviceService: DeviceService,
    public data: DataService
  ) { }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }
}
