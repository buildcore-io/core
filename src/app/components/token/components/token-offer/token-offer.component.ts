import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { OrderApi } from '@api/order.api';
import { TokenMarketApi } from '@api/token_market.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { Space } from '@functions/interfaces/models';
import { Token, TokenDistribution } from '@functions/interfaces/models/token';
import { UntilDestroy } from '@ngneat/until-destroy';
import bigDecimal from 'js-big-decimal';

export enum StepType {
  CONFIRM = 'Confirm'
}

@UntilDestroy()
@Component({
  selector: 'wen-token-offer',
  templateUrl: './token-offer.component.html',
  styleUrls: ['./token-offer.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenOfferComponent {
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
  @Input() price = 0;
  @Input() amount = 0;
  @Output() wenOnClose = new EventEmitter<void>();

  public agreeTermsConditions = false;
  public agreeTokenTermsConditions = false;
  public targetAddress?: string = '';
  public targetAmount?: number;
  public isCopied = false;
  private _isOpen = false;

  constructor(
    public auth: AuthService,
    public orderApi: OrderApi,
    public tokenMarketApi: TokenMarketApi,
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public unitsService: UnitsService,
    private notification: NotificationService,
    private cd: ChangeDetectorRef
  ) { }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
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
      count: Number(this.amount * 1000 * 1000),
      price: Number(this.price)
    };

    await this.auth.sign(params, (sc, finish) => {
      this.notification.processRequest(this.tokenMarketApi.sellToken(sc), $localize`Offer created.`, finish).subscribe(() => {
        this.close();
      });
    });
  }

  public getTargetAmount(): string {
    return bigDecimal.divide(bigDecimal.floor(bigDecimal.multiply(Number(this.amount * 1000 * 1000), Number(this.price))), 1000 * 1000, 6);
  }
}
