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
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { Member, Space } from '../../../../../functions/interfaces/models';
import { TransactionOrder, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from './../../../../../functions/interfaces/models/transaction';
import { UnitsHelper } from './../../../@core/utils/units-helper';
import { EntityType } from './../wallet-address.component';

export enum StepType {
  GENERATE = 'Generate',
  TRANSACTION = 'Transaction',
  WAIT = 'Wait',
  CONFIRMED = 'Confirmed'
}

@UntilDestroy()
@Component({
  selector: 'wen-iota-address',
  templateUrl: './iota-address.component.html',
  styleUrls: ['./iota-address.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IOTAAddressComponent implements OnInit, OnDestroy {
  @Input() currentStep = StepType.WAIT;
  @Input() entityType?: EntityType;
  @Input() entity?: Space|Member|null;
  @Output() onClose = new EventEmitter<void>();

  public stepType = StepType;
  public isCopied = false;
  public transaction$: BehaviorSubject<TransactionOrder|undefined> = new BehaviorSubject<TransactionOrder|undefined>(undefined);
  public expiryTicker$: BehaviorSubject<dayjs.Dayjs|null> = new BehaviorSubject<dayjs.Dayjs|null>(null);
  public receivedTransactions = false;
  public sendingMoneyBack = false;

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
    this.sendingMoneyBack = false;
    this.transaction$.pipe(untilDestroyed(this)).subscribe((val) => {
      if (val && val.type === TransactionType.ORDER) {
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
            this.orderApi.listen(tranId).pipe(untilDestroyed(this)).subscribe(<any>this.transaction$);
          }
        } else if (!val.linkedTransactions) {
          this.currentStep = StepType.TRANSACTION;
        }

        this.expiryTicker$.next(expiresOn);
      }

      if (val && val.type === TransactionType.PAYMENT && val.payload.reconciled === true) {
        this.receivedTransactions = true;
      }

      if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === false) {
        this.sendingMoneyBack = true;
      }

      // Credit
      if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === true) {
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

  public copyAddress() {
    if (!this.isCopied && this.transaction$.value?.payload.targetAddress) {
      copyToClipboard(this.transaction$.value?.payload.targetAddress);
      this.isCopied = true;
    }
  }

  public reset(): void {
    this.receivedTransactions = false;
    this.sendingMoneyBack = false;
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
    if (!this.transaction$.value?.payload.targetAddress || !this.transaction$.value?.payload.amount) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustUrl('iota://wallet/send/' + this.transaction$.value?.payload.targetAddress +
           '?amount=' + (this.transaction$.value?.payload.amount / 1000 / 1000) + '&unit=Mi');
  }

  public tanglePayDeepLink(): string {
    if (!this.transaction$.value?.payload.targetAddress || !this.transaction$.value?.payload.amount) {
      return '';
    }

    return '';
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
      });
    });
  }

  public ngOnDestroy(): void {
    this.transSubscription?.unsubscribe();
  }
}
