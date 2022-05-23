import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { OrderApi } from '@api/order.api';
import { TokenMarketApi } from '@api/token_market.api';
import { TokenPurchaseApi } from '@api/token_purchase.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsHelper } from '@core/utils/units-helper';
import { Space } from '@functions/interfaces/models';
import { Token, TokenDistribution } from '@functions/interfaces/models/token';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, filter } from 'rxjs';

export enum StepType {
  CONFIRM = 'Confirm'
}

@UntilDestroy()
@Component({
  selector: 'wen-token-offer-pre-mint',
  templateUrl: './token-offer-pre-mint.component.html',
  styleUrls: ['./token-offer-pre-mint.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenOfferPreMintComponent implements OnInit {
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
  public iotaControl: FormControl = new FormControl(null);
  public offeredRateControl: FormControl = new FormControl(null);
  public isAmountInput = false;
  public agreeTermsConditions = false;
  public agreeTokenTermsConditions = false;
  public targetAddress?: string = '';
  public targetAmount?: number;
  public isCopied = false;
  public listenAvgPrice24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  private _isOpen = false;

  constructor(
    public auth: AuthService,
    public orderApi: OrderApi,
    public tokenMarketApi: TokenMarketApi,
    public deviceService: DeviceService,
    private tokenPurchaseApi: TokenPurchaseApi,
    private notification: NotificationService,
    public previewImageService: PreviewImageService,
    private cd: ChangeDetectorRef
  ) { }

  public ngOnInit() {
    if (this.token?.uid) {
      this.tokenPurchaseApi.listenAvgPrice24h(this.token.uid).pipe(untilDestroyed(this)).subscribe(this.listenAvgPrice24h$)
    }
    
    this.amountControl.valueChanges
      .pipe(
        filter(() => this.isAmountInput),
        untilDestroyed(this)
      )
      .subscribe((val: string) => {
        this.iotaControl.setValue((Number(val) * Number(this.offeredRateControl?.value || 0)).toFixed(2));
        this.cd.markForCheck();
      });
      
    this.iotaControl.valueChanges
      .pipe(
        filter(() => !this.isAmountInput),
        untilDestroyed(this)
      )
      .subscribe((val: string) => {
        this.amountControl.setValue((Number(val) / Number(this.offeredRateControl?.value || 0)).toFixed(2));
        this.cd.markForCheck();
      });

    this.offeredRateControl.valueChanges
      .pipe(
        untilDestroyed(this)
      )
      .subscribe((val: string) => {
        if (this.isAmountInput) {
          this.iotaControl.setValue((Number(this.amountControl.value) * Number(val)).toFixed(2));
        } else {
          this.amountControl.setValue((Number(this.iotaControl.value) / Number(val)).toFixed(2));
        }
        this.cd.markForCheck();
      });
  }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public formatBest(amount: number | undefined | null, mega = false): string {
    if (!amount) {
      return '-';
    }

    return UnitsHelper.formatBest(Math.floor(Number(amount) * (mega ? (1000 * 1000) : 1)), 2);
  }

  public formatTokenBest(amount?: number|null): string {
    if (!amount) {
      return '0';
    }

    return (amount / 1000 / 1000).toFixed(2);
  }
  
  public extractAmount(formattedText: string): string {
    return formattedText.substring(0, formattedText.length - 3);
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
