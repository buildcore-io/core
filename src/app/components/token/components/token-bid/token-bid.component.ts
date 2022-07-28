import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { OrderApi } from '@api/order.api';
import { TokenMarketApi } from '@api/token_market.api';
import { TokenPurchaseApi } from '@api/token_purchase.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { copyToClipboard } from '@core/utils/tools.utils';
import { Space, Transaction, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from '@functions/interfaces/models';
import { Timestamp } from '@functions/interfaces/models/base';
import { Token } from '@functions/interfaces/models/token';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HelperService } from '@pages/token/services/helper.service';
import * as dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

export enum StepType {
  CONFIRM = 'Confirm',
  TRANSACTION = 'Transaction',
  COMPLETE = 'Complete'
}

interface HistoryItem {
  uniqueId: string;
  date: dayjs.Dayjs|Timestamp|null;
  label: string;
  link?: string;
}

@UntilDestroy()
@Component({
  selector: 'wen-token-bid',
  templateUrl: './token-bid.component.html',
  styleUrls: ['./token-bid.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenBidComponent implements OnInit, OnDestroy {
  @Input() currentStep = StepType.CONFIRM;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() token?: Token;
  @Input() space?: Space;
  @Input() price = 0;
  @Input() amount = 0;
  @Output() wenOnClose = new EventEmitter<void>();

  public agreeTermsConditions = false;
  public agreeTokenTermsConditions = false;
  public targetAddress?: string = '';
  public invalidPayment = false;
  public targetAmount?: number;
  public receivedTransactions = false;
  public purchasedAmount = 0;
  public history: HistoryItem[] = [];
  public expiryTicker$: BehaviorSubject<dayjs.Dayjs|null> = new BehaviorSubject<dayjs.Dayjs|null>(null);
  public listenAvgPrice24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public transaction$: BehaviorSubject<Transaction|undefined> = new BehaviorSubject<Transaction|undefined>(undefined);
  public isCopied = false;
  private _isOpen = false;
  private transSubscription?: Subscription;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public helper: HelperService,
    public unitsService: UnitsService,
    private auth: AuthService,
    private notification: NotificationService,
    private tokenPurchaseApi: TokenPurchaseApi,
    private orderApi: OrderApi,
    private tokenMarketApi: TokenMarketApi,
    private cd: ChangeDetectorRef
  ) { }

  public ngOnInit(): void {
    this.receivedTransactions = false;
    const listeningToTransaction: string[] = [];
    this.transaction$.pipe(untilDestroyed(this)).subscribe((val) => {
      if (val && val.type === TransactionType.ORDER) {
        this.targetAddress = val.payload.targetAddress;
        const expiresOn: dayjs.Dayjs = dayjs(val.payload.expiresOn!.toDate());
        if (expiresOn.isBefore(dayjs())) {
          return;
        }
        if (val.linkedTransactions?.length > 0) {
          this.currentStep = StepType.TRANSACTION;
          // Listen to other transactions.
          for (const tranId of val.linkedTransactions) {
            if (listeningToTransaction.indexOf(tranId) > -1) {
              continue;
            }

            listeningToTransaction.push(tranId);
            this.orderApi.listen(tranId).pipe(untilDestroyed(this)).subscribe(<any> this.transaction$);
          }
        } else if (!val.linkedTransactions || val.linkedTransactions.length === 0) {
          this.currentStep = StepType.TRANSACTION;
        }

        this.expiryTicker$.next(expiresOn);
      }

      if (val && val.type === TransactionType.PAYMENT && val.payload.reconciled === true) {
        this.pushToHistory(val.uid + '_payment_received', val.createdOn, $localize`Payment received.`, (<any>val).payload?.chainReference);
      }

      if (val && val.type === TransactionType.PAYMENT && val.payload.reconciled === true && (<any>val).payload.invalidPayment === false) {
        // Let's add delay to achive nice effect.
        setTimeout(() => {
          this.pushToHistory(val.uid + '_confirming_trans', val.createdOn, $localize`Confirming transaction.`);
        }, 1000);

        setTimeout(() => {
          this.pushToHistory(val.uid + '_confirmed_trans', val.createdOn, $localize`Transaction confirmed.`);
          this.purchasedAmount = val.payload.amount;
          this.receivedTransactions = true;
          this.currentStep = StepType.COMPLETE;
          this.cd.markForCheck();
        }, 2000);
      }

      if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === true && !val.payload?.walletReference?.chainReference) {
        this.pushToHistory(val.uid + '_false', val.createdOn, $localize`Invalid amount received. Refunding transaction...`);
      }

      if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === true && val.payload?.walletReference?.chainReference) {
        this.pushToHistory(val.uid + '_true', dayjs(), $localize`Invalid payment refunded.`, val.payload?.walletReference?.chainReference);


        // Let's go back to wait. With slight delay so they can see this.
        setTimeout(() => {
          this.currentStep = StepType.TRANSACTION;
          this.invalidPayment = true;
          this.cd.markForCheck();
        }, 2000);
      }

      this.cd.markForCheck();
    });

    if (this.token?.uid) {
      this.tokenPurchaseApi.listenAvgPrice24h(this.token.uid).pipe(untilDestroyed(this)).subscribe(this.listenAvgPrice24h$)
    }

    // Run ticker.
    const int: Subscription = interval(1000).pipe(untilDestroyed(this)).subscribe(() => {
      this.expiryTicker$.next(this.expiryTicker$.value);

      // If it's in the past.
      if (this.expiryTicker$.value) {
        const expiresOn: dayjs.Dayjs = dayjs(this.expiryTicker$.value).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
        if (expiresOn.isBefore(dayjs())) {
          this.expiryTicker$.next(null);
          int.unsubscribe();
          this.reset();
        }
      }
    });
  }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public getExplorerLink(link: string): string {
    return 'https://thetangle.org/search/' + link;
  }

  public pushToHistory(uniqueId: string, date?: dayjs.Dayjs|Timestamp|null, text?: string, link?: string): void {
    if (this.history.find((s) => { return s.uniqueId === uniqueId; })) {
      return;
    }

    if (date && text) {
      this.history.unshift({
        uniqueId: uniqueId,
        date: date,
        label: text,
        link: link
      });
    }
  }

  public reset(): void {
    this.isOpen = false;
    this.currentStep = StepType.CONFIRM;
    this.cd.markForCheck();
  }


  public async proceedWithBid(): Promise<void> {
    if (!this.token || !this.agreeTermsConditions) {
      return;
    }

    const params: any = {
      token: this.token.uid,
      count: Number(this.amount * 1000 * 1000),
      price: Number(this.price)
    };

    await this.auth.sign(params, (sc, finish) => {
      this.notification.processRequest(this.tokenMarketApi.buyToken(sc), $localize`Bid created.`, finish).subscribe((val: any) => {
        this.transSubscription?.unsubscribe();
        this.transSubscription = this.orderApi.listen(val.uid).subscribe(<any> this.transaction$);
        this.pushToHistory(val.uid, dayjs(), $localize`Waiting for transaction...`);
      });
    });
  }

  public get stepType(): typeof StepType {
    return StepType;
  }

  public copyAddress() {
    if (!this.isCopied && this.targetAddress) {
      copyToClipboard(this.targetAddress);
      this.isCopied = true;
      setTimeout(() => {
        this.isCopied = false;
        this.cd.markForCheck();
      }, 3000);
    }
  }

  public getTargetAmount(): string {
    return bigDecimal.divide(bigDecimal.floor(bigDecimal.multiply(Number(this.amount * 1000 * 1000), Number(this.price))), 1000 * 1000, 6);
  }

  public ngOnDestroy(): void {
    this.transSubscription?.unsubscribe();
  }
}
