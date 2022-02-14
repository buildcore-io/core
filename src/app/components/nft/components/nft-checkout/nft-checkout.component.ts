import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { OrderApi } from '@api/order.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { copyToClipboard } from '@core/utils/tools.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { Collection, CollectionType, TransactionOrder, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from 'functions/interfaces/models';
import { Nft } from 'functions/interfaces/models/nft';
import { BehaviorSubject, interval, Subscription } from 'rxjs';

export enum StepType {
  CONFIRM = 'Confirm',
  TRANSACTION = 'Transaction',
  WAIT = 'Wait',
  COMPLETE = 'Complete'
}

@UntilDestroy()
@Component({
  selector: 'wen-nft-checkout',
  templateUrl: './nft-checkout.component.html',
  styleUrls: ['./nft-checkout.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftCheckoutComponent implements OnInit, OnDestroy {
  @Input() currentStep = StepType.CONFIRM;
  @Input() isOpen = false;
  @Input() nft?: Nft|null;
  @Input() collection?: Collection|null;
  @Output() onClose = new EventEmitter<void>();

  public stepType = StepType;
  public isCopied = false;
  public agreeTermsConditions = false;
  public transaction$: BehaviorSubject<TransactionOrder|undefined> = new BehaviorSubject<TransactionOrder|undefined>(undefined);
  public expiryTicker$: BehaviorSubject<dayjs.Dayjs|null> = new BehaviorSubject<dayjs.Dayjs|null>(null);
  public receivedTransactions = false;

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
    this.transaction$.pipe(untilDestroyed(this)).subscribe((val) => {
      if (val && val.type === TransactionType.ORDER) {
        const expiresOn: dayjs.Dayjs = dayjs(val.createdOn!.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
        if (expiresOn.isBefore(dayjs())) {
          // It's expired.
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
        this.currentStep = StepType.COMPLETE;
      }

      this.cd.markForCheck();
    });

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

  public get lockTime(): number {
    return TRANSACTION_AUTO_EXPIRY_MS / 1000 / 60;
  }

  public copyAddress() {
    if (!this.isCopied && this.transaction$.value?.payload.targetAddress) {
      copyToClipboard(this.transaction$.value?.payload.targetAddress);
      this.isCopied = true;
    }
  }

  public reset(): void {
    this.receivedTransactions = false;
    this.isOpen = false;
    this.currentStep = StepType.CONFIRM;
  }

  public close(): void {
    this.reset();
    this.onClose.next();
  }

  public formatBest(amount: number|undefined): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
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

  public async proceedWithOrder(): Promise<void> {
    if (!this.collection || !this.nft || !this.agreeTermsConditions) {
      return;
    }

    const params: any = {
      collection: this.collection.uid
    };

    if (this.collection.type === CollectionType.CLASSIC) {
      params.nft = this.nft.uid;
    }

    // If owner is set CollectionType is not relevant.
    if (this.nft.owner) {
      params.nft = this.nft.uid;
    }

    await this.auth.sign(params, (sc, finish) => {
      this.notification.processRequest(this.orderApi.orderNft(sc), 'Order created.', finish).subscribe((val: any) => {
        this.transSubscription?.unsubscribe();
        this.transSubscription = this.orderApi.listen(val.uid).subscribe(<any>this.transaction$);
      });
    });
  }

  public ngOnDestroy(): void {
    this.transSubscription?.unsubscribe();
  }
}
