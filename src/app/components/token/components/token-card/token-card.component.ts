import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Token } from '@functions/interfaces/models/token';
import { DataService } from '@pages/token/services/data.service';
import dayjs from 'dayjs';

export enum TokenCardType {
  UPCOMING = 0,
  ONGOING = 1,
  ENDING = 2
}

@Component({
  selector: 'wen-token-card',
  templateUrl: './token-card.component.html',
  styleUrls: ['./token-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenCardComponent {
  @Input()
  set token(value: Token | undefined) {
    this._token = value;
    this.setCardType();
  }
  get token(): Token | undefined {
    return this._token;
  }

  // TODO: needs to be set dynamically
  public cardType = TokenCardType.UPCOMING;
  public path = ROUTER_UTILS.config.token.root;
  private _token?: Token;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public data: DataService,
    private cd: ChangeDetectorRef
  ) { }

  public get tokenCardTypes(): typeof TokenCardType {
    return TokenCardType;
  }

  public formatTokenBest(amount?: number|null): string {
    if (!amount) {
      return '0';
    }

    return (amount / 1000 / 1000).toFixed(2);
  }

  public getEndDate(): dayjs.Dayjs {
    return dayjs(this.token?.saleStartDate?.toDate()).add(this.token?.saleLength || 0, 'ms');
  }

  public getPrc(): number {
    const prc = ((this.token?.totalDeposit || 0) / (this.token?.pricePerToken || 0) / this.getPublicSaleSupply());
    return (prc > 1 ? 1 : prc) * 100;
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

  private setCardType(): void {
    const endDate = this.getEndDate();
    // 1 / 5 is close to ending.
    if (endDate.clone().subtract((this.token?.saleLength || 0) / 5).isBefore(dayjs())) {
      this.cardType = TokenCardType.ENDING;
    } else if (dayjs(this.token?.saleStartDate?.toDate()).isBefore(dayjs()) && endDate.isAfter(dayjs())) {
      this.cardType = TokenCardType.ONGOING;
    } else {
      this.cardType = TokenCardType.UPCOMING;
    }

    this.cd.markForCheck();
  }
}
