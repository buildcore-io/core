import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Token } from '@functions/interfaces/models/token';
import { DataService } from '@pages/token/services/data.service';

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
    // console.log(this.token);
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
    public data: DataService
  ) {
    setTimeout(() => {
      console.log(this.token);
    }, 100);
  }

  public get tokenCardTypes(): typeof TokenCardType {
    return TokenCardType;
  }

  public getCountdownDate(): Date {
    return new Date('2022-05-30');
  }

  public getCountdownTitle(): string {
    return $localize`Cooldown period ends`;
  }
}
