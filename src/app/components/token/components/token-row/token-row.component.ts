import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';

@Component({
  selector: 'wen-token-row',
  templateUrl: './token-row.component.html',
  styleUrls: ['./token-row.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenRowComponent {
  // TODO: delete this
  public d = new Date();

  constructor(
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService
  ) {}
}
