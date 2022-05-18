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
  public path = ROUTER_UTILS.config.token.root;
  public tradePath = ROUTER_UTILS.config.token.trade;

  constructor(
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService
  ) { }

  public formatBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(Number(amount), 2);
  }

  public formatTokenBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return (amount / 1000 / 1000).toFixed(2).toString();
  }

  public available(): boolean {
    return dayjs(this.token?.saleStartDate?.toDate()).isBefore(dayjs()) && this.token?.status === TokenStatus.AVAILABLE;
  }

  public saleNotStarted(): boolean {
    return dayjs(this.token?.saleStartDate?.toDate()).isAfter(dayjs());
  }

  public getEndDate(): dayjs.Dayjs {
    return dayjs(this.token?.saleStartDate?.toDate()).add(this.token?.saleLength || 0, 'ms');
  }

  public saleEnded(): boolean {
    return this.getEndDate().isBefore(dayjs());
  }

  public isInCoolDown(): boolean {
    return dayjs(this.token?.coolDownEnd?.toDate()).isAfter(dayjs()) && this.saleEnded();
  }

  public preMinted(): boolean {
    return this.token?.status === TokenStatus.PRE_MINTED;
  }

  public getPublicSaleSupply(): number {
    let sup = 0;
    this.token?.allocations.forEach((b) => {
      if (b.isPublicSale) {
        sup = b.percentage / 100;
      }
    });

    return (this.token?.totalSupply || 0) * sup;
  }

  public getPrc(): number {
    const prc = ((this.token?.totalDeposit || 0) / (this.token?.pricePerToken || 0) / this.getPublicSaleSupply());
    return (prc > 1 ? 1 : prc) * 100;
  }
}
