import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShareComponentSize } from '@components/share/share.component';

@Component({
  selector: 'wen-token-buy',
  templateUrl: './token-buy.component.html',
  styleUrls: ['./token-buy.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenBuyComponent {
  public isBuyTokensVisible = false;
  public isScheduleSaleVisible = false;

  public getShareUrl(): string {
    return window.location.href;
  }
  
  public get shareSizes(): typeof ShareComponentSize {
    return ShareComponentSize;
  }
}
