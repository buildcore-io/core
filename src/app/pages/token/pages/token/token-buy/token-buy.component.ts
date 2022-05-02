import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'wen-token-buy',
  templateUrl: './token-buy.component.html',
  styleUrls: ['./token-buy.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenBuyComponent {
  public isBuyTokensVisible = false;

  public getShareUrl(): string {
    return window.location.href;
  }
}
