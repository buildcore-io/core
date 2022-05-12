import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShareComponentSize } from '@components/share/share.component';
import { Token } from '@functions/interfaces/models/token';
import { DataService } from '@pages/token/services/data.service';

@Component({
  selector: 'wen-token-buy',
  templateUrl: './token-buy.component.html',
  styleUrls: ['./token-buy.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenBuyComponent {
  public isBuyTokensVisible = false;
  public isScheduleSaleVisible = false;

  constructor(
    public data: DataService
  ) {}

  public getShareUrl(token?: Token | null): string {
    return token?.wenUrlShort || token?.wenUrl || window.location.href;
  }
  
  public get shareSizes(): typeof ShareComponentSize {
    return ShareComponentSize;
  }
}
