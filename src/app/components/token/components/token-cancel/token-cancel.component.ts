import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TokenMarketApi } from '@api/token_market.api';
import { AuthService } from '@components/auth/services/auth.service';
import { NotificationService } from '@core/services/notification';
import { PreviewImageService } from '@core/services/preview-image';
import { Token, TokenTradeOrder, TokenTradeOrderType } from '@functions/interfaces/models';
import bigDecimal from 'js-big-decimal';

@Component({
  selector: 'wen-token-cancel',
  templateUrl: './token-cancel.component.html',
  styleUrls: ['./token-cancel.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenCancelComponent {
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: Token;
  @Input() tradeOrder?: TokenTradeOrder;
  @Input() price = 0;
  @Input() amount = 0;
  @Output() wenOnClose = new EventEmitter<void>();

  private _isOpen = false;
  
  constructor(
    public auth: AuthService,
    public previewImageService: PreviewImageService,
    private notification: NotificationService,
    private tokenMarketApi: TokenMarketApi
  ) {}

  public async cancel(): Promise<void> {
    if (!this.tradeOrder) return;
    
    const params: any = {
      uid: this.tradeOrder.uid
    };

    await this.auth.sign(params, (sc, finish) => {
      this.notification.processRequest(this.tokenMarketApi.cancel(sc), $localize`Cancelled.`, finish).subscribe(() => {
        this.close();
      });
    });
  }

  public close(): void {
    this.isOpen = false;
    this.wenOnClose.next();
  }
  
  public getTargetAmount(): string {
    return bigDecimal.divide(bigDecimal.floor(bigDecimal.multiply(Number(this.amount * 1000 * 1000), Number(this.price))), 1000 * 1000, 6);
  }

  public get tokenTradeOrderTypes(): typeof TokenTradeOrderType {
    return TokenTradeOrderType;
  }

  public get getTitle(): string {
    if (!this.tradeOrder) return '';
    return this.tradeOrder.type === TokenTradeOrderType.BUY ? $localize`Cancel your bid` : $localize`Cancel your offer`;
  }
}
