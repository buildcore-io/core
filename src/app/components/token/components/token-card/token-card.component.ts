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

  public getCountdownDate(): Date {
    return this.token?.coolDownEnd?.toDate() || new Date();
  }

  private setCardType(): void {
    if (dayjs(this.token?.saleStartDate?.toDate()).add(this.token?.saleLength || 0, 'ms').isBefore(dayjs())) {
      this.cardType = TokenCardType.ENDING;
    } else if (dayjs(this.token?.saleStartDate?.toDate()).isBefore(dayjs())) {
      this.cardType = TokenCardType.ONGOING;
    } else {
      this.cardType = TokenCardType.UPCOMING;
    }
    this.cd.markForCheck();
  }
}
