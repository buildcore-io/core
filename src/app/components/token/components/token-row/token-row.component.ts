import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { Token, TokenStatus } from '@functions/interfaces/models/token';
import dayjs from 'dayjs';

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

  public available(): boolean {
    return dayjs(this.token?.saleStartDate?.toDate()).isBefore(dayjs());
  }

  public saleEnded(): boolean {
    return dayjs(this.token?.saleStartDate?.toDate()).add(this.token?.saleLength || 0, 'ms').isAfter(dayjs());
  }

  public isInCoolDown(): boolean {
    return dayjs(this.token?.coolDownEnd?.toDate()).isBefore(dayjs()) && this.saleEnded();
  }

  public preMinted(): boolean {
    return this.token?.status === TokenStatus.PRE_MINTED;
  }
}
