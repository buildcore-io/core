import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UnitsHelper } from '@core/utils/units-helper';
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
  public path = ROUTER_UTILS.config.token.root;

  constructor(
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService
  ) { }

  public formatBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }
}
