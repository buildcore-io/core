import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { OrderApi } from '@api/order.api';
import { TokenMarketApi } from '@api/token_market.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsHelper } from '@core/utils/units-helper';
import { Space } from '@functions/interfaces/models';
import { Token, TokenDistribution } from '@functions/interfaces/models/token';

export enum StepType {
  CONFIRM = 'Confirm'
}

@Component({
  selector: 'wen-token-offer-pre-mint',
  templateUrl: './token-offer-pre-mint.component.html',
  styleUrls: ['./token-offer-pre-mint.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenOfferPreMintComponent {
  @Input() currentStep = StepType.CONFIRM;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: Token;
  @Input() memberDistribution?: TokenDistribution;
  @Input() space?: Space;
  @Output() wenOnClose = new EventEmitter<void>();

  public amountControl: FormControl = new FormControl(null);
  public offeredRateControl: FormControl = new FormControl(null);
  public agreeTermsConditions = false;
  public agreeTokenTermsConditions = false;
  public targetAddress?: string = 'dummy_address';
  public targetAmount?: number;
  public isCopied = false;
  private _isOpen = false;

  constructor(
    public auth: AuthService,
    public orderApi: OrderApi,
    public tokenMarketApi: TokenMarketApi,
    public deviceService: DeviceService,
    private notification: NotificationService,
    public previewImageService: PreviewImageService,
    private cd: ChangeDetectorRef
  ) { }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public formatBest(amount: number | undefined | null): string {
    if (!amount) {
      return '-';
    }

    return UnitsHelper.formatBest(Number(amount), 2);
  }

  public formatTokenBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return (amount / 1000 / 1000).toFixed(2).toString();
  }

  public reset(): void {
    this.isOpen = false;
    this.currentStep = StepType.CONFIRM;
    this.cd.markForCheck();
  }

  public get stepType(): typeof StepType {
    return StepType;
  }

  public async proceedWithOrder(): Promise<void> {
    if (!this.token || !this.agreeTermsConditions) {
      return;
    }

    const params: any = {
      token: this.token.uid,
      count: Number(this.amountControl.value * 1000 * 1000),
      price: Number(this.offeredRateControl.value)
    };

    await this.auth.sign(params, (sc, finish) => {
      this.notification.processRequest(this.tokenMarketApi.sellToken(sc), $localize`Offer created.`, finish).subscribe(() => {
        this.close();
      });
    });
  }
}
