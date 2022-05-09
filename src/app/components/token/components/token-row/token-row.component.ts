import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { Token } from '@functions/interfaces/models/token';

@Component({
  selector: 'wen-token-row',
  templateUrl: './token-row.component.html',
  styleUrls: ['./token-row.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenRowComponent {
  @Input() token?: Token;
  public d = new Date();

  constructor(
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService
  ) {}
}
