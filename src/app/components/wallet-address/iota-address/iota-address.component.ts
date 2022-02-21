import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";
import { OrderApi } from "@api/order.api";
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { getItem, removeItem, setItem, StorageItem } from '@core/utils';
import { copyToClipboard } from '@core/utils/tools.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { Timestamp } from 'functions/interfaces/models/base';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { Member, Space } from '../../../../../functions/interfaces/models';
import { Transaction, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from './../../../../../functions/interfaces/models/transaction';
import { UnitsHelper } from './../../../@core/utils/units-helper';
import { EntityType } from './../wallet-address.component';

export enum StepType {
  GENERATE = 'Generate',
  TRANSACTION = 'Transaction',
  WAIT = 'Wait',
  CONFIRMED = 'Confirmed'
}

interface HistoryItem {
  uniqueId: string;
  date: dayjs.Dayjs|Timestamp|null;
  label: string;
  link?: string;
}

@UntilDestroy()
@Component({
  selector: 'wen-iota-address',
  templateUrl: './iota-address.component.html',
  styleUrls: ['./iota-address.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IOTAAddressComponent implements OnInit, OnDestroy {
  @Input() currentStep = StepType.GENERATE;
  @Input() entityType?: EntityType;
  @Input() entity?: Space|Member|null;
  @Output() onClose = new EventEmitter<void>();

  public stepType = StepType;
  public isCopied = false;
  public transaction$: BehaviorSubject<Transaction|undefined> = new BehaviorSubject<Transaction|undefined>(undefined);
  public expiryTicker$: BehaviorSubject<dayjs.Dayjs|null> = new BehaviorSubject<dayjs.Dayjs|null>(null);
  public receivedTransactions = false;
  public history: HistoryItem[] = [];
  public invalidPayment = false;
  public targetAddress?: string;
  public targetAmount?: number;

  private transSubscription?: Subscription;

  constructor(
    public deviceService: DeviceService,
    private auth: AuthService,
    private notification: NotificationService,
    private cd: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private orderApi: OrderApi
  ) {
  }

  public ngOnInit(): void {
    this.receivedTransactions = false;
    const listeningToTransaction: string[] = [];
    this.transaction$.pipe(untilDestroyed(this)).subscribe((val) => {
      if (val && val.type === TransactionType.ORDER) {
        this.targetAddress = val.payload.targetAddress;
        this.targetAmount = val.payload.amount;
        const expiresOn: dayjs.Dayjs = dayjs(val.createdOn!.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
        if (expiresOn.isBefore(dayjs())) {
          // It's expired.
          removeItem(StorageItem.VerificationTransaction);
          return;
        }

        if (val.linkedTransactions?.length > 0) {

          this.currentStep = StepType.WAIT;
          // Listen to other transactions.
          for (const tranId of val.linkedTransactions) {
            if (listeningToTransaction.indexOf(tranId) > -1) {
              continue;
            }

            listeningToTransaction.push(tranId);
            this.orderApi.listen(tranId).pipe(untilDestroyed(this)).subscribe(<any>this.transaction$);
          }
        } else if (!val.linkedTransactions) {
          this.currentStep = StepType.TRANSACTION;
        }

        this.expiryTicker$.next(expiresOn);
      }

      if (val && val.type === TransactionType.PAYMENT && val.payload.reconciled === true) {
        this.pushToHistory(val.uid + '_payment_received', val.createdOn, 'Payment received.', (<any>val).payload?.chainReference);
        this.receivedTransactions = true;
      }

      if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === true && val.payload.invalidPayment === true && !val.payload?.walletReference?.chainReference) {
        this.pushToHistory(val.uid + '_credit_back', dayjs(), 'Invalid amount received. Refunding transaction...');
      }

      if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === true && val.payload.invalidPayment === false && !val.payload?.walletReference?.chainReference) {
        this.pushToHistory(val.uid + '_credit_back', dayjs(), 'Refunding your payment...');
      }

      // Credit
      if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === true && val.payload?.walletReference?.chainReference) {
        this.pushToHistory(val.uid + '_refund_complete', dayjs(), 'Payment refunded.');

        if (val.payload.invalidPayment) {
          setTimeout(() => {
            this.currentStep = StepType.TRANSACTION;
            this.invalidPayment = true;
            this.cd.markForCheck();
          }, 2000);
        }
      }

      if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === true && val.payload.invalidPayment === false && val.payload?.walletReference?.chainReference) {
        this.pushToHistory(val.uid + '_confirmed_address', dayjs(), 'Address confirmed.');
        removeItem(StorageItem.VerificationTransaction);
        this.currentStep = StepType.CONFIRMED;
      }

      this.cd.markForCheck();
    });

    if (getItem(StorageItem.VerificationTransaction)) {
      this.transSubscription = this.orderApi.listen(<string>getItem(StorageItem.VerificationTransaction)).subscribe(<any>this.transaction$);
    }

    // Run ticker.
    const int: Subscription = interval(1000).pipe(untilDestroyed(this)).subscribe(() => {
      this.expiryTicker$.next(this.expiryTicker$.value);

      // If it's in the past.
      if (this.expiryTicker$.value) {
        const expiresOn: dayjs.Dayjs = dayjs(this.expiryTicker$.value).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
        if (expiresOn.isBefore(dayjs())) {
          this.expiryTicker$.next(null);
          removeItem(StorageItem.VerificationTransaction);
          int.unsubscribe();
          this.reset();
        }
      }
    });
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

  public getExplorerLink(link: string): string {
    return 'https://explorer.iota.org/mainnet/search/' + link;
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

  public reset(): void {
    this.receivedTransactions = false;
    this.currentStep = StepType.GENERATE;
  }

  public close(): void {
    this.reset();
    this.onClose.next();
  }

  public formatBest(amount: number|undefined): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 4);
  }

  public fireflyDeepLink(): SafeUrl {
    if (!this.targetAddress || !this.targetAmount) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustUrl('iota://wallet/send/' + this.targetAddress +
           '?amount=' + (this.targetAmount / 1000 / 1000) + '&unit=Mi');
  }

  public tanglePayDeepLink(): string {
    if (!this.targetAddress || !this.targetAmount) {
      return '';
    }

    return '';
  }

  public isSpaceVerification(): boolean {
    return this.entityType === EntityType.SPACE;
  }

  public isExpired(val?: Transaction | null): boolean {
    if (!val?.createdOn) {
      return false;
    }

    const expiresOn: dayjs.Dayjs = dayjs(val.createdOn.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
    return expiresOn.isBefore(dayjs()) && val.type === TransactionType.ORDER;
  }

  public async initVerification(): Promise<void> {
    if (!this.entity) {
      return;
    }

    const params: any = {};
    if (this.entityType === EntityType.SPACE) {
      params.space = this.entity.uid;
    }

    await this.auth.sign(params, (sc, finish) => {
      this.notification.processRequest(this.orderApi.validateAddress(sc), 'Validation requested.', finish).subscribe((val: any) => {
        this.transSubscription?.unsubscribe();
        setItem(StorageItem.VerificationTransaction, val.uid);
        this.transSubscription = this.orderApi.listen(val.uid).subscribe(<any>this.transaction$);
        this.pushToHistory(val.uid, dayjs(), 'Waiting for transaction...');
      });
    });
  }

  public ngOnDestroy(): void {
    this.transSubscription?.unsubscribe();
  }
}
