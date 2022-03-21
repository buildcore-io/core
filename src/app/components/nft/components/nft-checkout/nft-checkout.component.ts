import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { FileApi } from '@api/file.api';
import { NftApi } from '@api/nft.api';
import { OrderApi } from '@api/order.api';
import { AuthService } from '@components/auth/services/auth.service';
import { CheckoutService } from '@core/services/checkout';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { getItem, removeItem, setItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { copyToClipboard } from '@core/utils/tools.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { MIN_AMOUNT_TO_TRANSFER } from '@functions/interfaces/config';
import { Collection, CollectionType, Transaction, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from '@functions/interfaces/models';
import { Timestamp } from '@functions/interfaces/models/base';
import { Nft } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { BehaviorSubject, firstValueFrom, interval, Subscription, take } from 'rxjs';

export enum StepType {
  CONFIRM = 'Confirm',
  TRANSACTION = 'Transaction',
  WAIT = 'Wait',
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
  selector: 'wen-nft-checkout',
  templateUrl: './nft-checkout.component.html',
  styleUrls: ['./nft-checkout.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftCheckoutComponent implements OnInit, OnDestroy {
  @Input() currentStep = StepType.CONFIRM;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
    this.checkoutService.modalOpen$.next(value);
  }
  public get isOpen(): boolean {
    return this._isOpen;
  }
  @Input()
  set nft(value: Nft|null|undefined) {
    this._nft = value;
    if (this._nft) {
      this.fileApi.getMetadata(this._nft.media).pipe(take(1), untilDestroyed(this)).subscribe((o) => {
        if (o.contentType.match('video/.*')) {
          this.mediaType = 'video';
        } else if (o.contentType.match('image/.*')) {
          this.mediaType = 'image';
        }

        this.cd.markForCheck();
      });
    }
  }
  get nft(): Nft|null|undefined {
    return this._nft;
  }

  @Input() collection?: Collection|null;
  @Output() wenOnClose = new EventEmitter<void>();

  public purchasedNft?: Nft|null;
  public stepType = StepType;
  public isCopied = false;
  public agreeTermsConditions = false;
  public transaction$: BehaviorSubject<Transaction|undefined> = new BehaviorSubject<Transaction|undefined>(undefined);
  public expiryTicker$: BehaviorSubject<dayjs.Dayjs|null> = new BehaviorSubject<dayjs.Dayjs|null>(null);
  public receivedTransactions = false;
  public mediaType: 'video'|'image'|undefined;
  public history: HistoryItem[] = [];
  public invalidPayment = false;
  public targetAddress?: string;
  public targetAmount?: number;
  private _isOpen = false;
  private _nft?: Nft|null;

  private transSubscription?: Subscription;
  public path = ROUTER_UTILS.config.nft.root;
  constructor(
    public deviceService: DeviceService,
    private checkoutService: CheckoutService,
    private auth: AuthService,
    private router: Router,
    private notification: NotificationService,
    private cd: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private orderApi: OrderApi,
    private nftApi: NftApi,
    private fileApi: FileApi,
  ) {}

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
          removeItem(StorageItem.CheckoutTransaction);
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
      }

      if (val && val.type === TransactionType.PAYMENT && val.payload.reconciled === true && (<any>val).payload.invalidPayment === false) {
        // Let's add delay to achive nice effect.
        setTimeout(() => {
          this.pushToHistory(val.uid + '_confirming_trans', dayjs(), 'Confirming transaction.');
        }, 1000);

        setTimeout(() => {
          this.pushToHistory(val.uid + '_confirmed_trans', dayjs(), 'Transaction confirmed.');
          this.receivedTransactions = true;
          this.currentStep = StepType.COMPLETE;
          this.cd.markForCheck();
        }, 2000);

        // Load purchased NFT.
        if (val.payload.nft) {
          firstValueFrom(this.nftApi.listen(val.payload.nft)).then((obj) => {
            if (obj) {
              this.purchasedNft = obj;
              this.fileApi.getMetadata(this.purchasedNft.media).pipe(take(1), untilDestroyed(this)).subscribe((o) => {
                if (o.contentType.match('video/.*')) {
                  this.mediaType = 'video';
                } else if (o.contentType.match('image/.*')) {
                  this.mediaType = 'image';
                }

                this.cd.markForCheck();
              });
              this.cd.markForCheck();
            }
          });
        }
      }

      if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === true && !val.payload?.walletReference?.chainReference) {
        this.pushToHistory(val.uid + '_false', val.createdOn, 'Invalid amount received. Refunding transaction...');
      }

      if (val && val.type === TransactionType.CREDIT && val.payload.reconciled === true && val.payload?.walletReference?.chainReference) {
        this.pushToHistory(val.uid + '_true', dayjs(), 'Invalid payment refunded.', val.payload?.walletReference?.chainReference);


        // Let's go back to wait. With slight delay so they can see this.
        setTimeout(() => {
          this.currentStep = StepType.TRANSACTION;
          this.invalidPayment = true;
          this.cd.markForCheck();
        }, 2000);
      }

      this.cd.markForCheck();
    });

    if (getItem(StorageItem.CheckoutTransaction)) {
      this.transSubscription = this.orderApi.listen(<string>getItem(StorageItem.CheckoutTransaction)).subscribe(<any>this.transaction$);
    }

    // Run ticker.
    const int: Subscription = interval(1000).pipe(untilDestroyed(this)).subscribe(() => {
      this.expiryTicker$.next(this.expiryTicker$.value);

      // If it's in the past.
      if (this.expiryTicker$.value) {
        const expiresOn: dayjs.Dayjs = dayjs(this.expiryTicker$.value).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
        if (expiresOn.isBefore(dayjs())) {
          this.expiryTicker$.next(null);
          removeItem(StorageItem.CheckoutTransaction);
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

  public get lockTime(): number {
    return TRANSACTION_AUTO_EXPIRY_MS / 1000 / 60;
  }

  public getExplorerLink(link: string): string {
    return 'https://thetangle.org/search/' + link;
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

  public discount(): number {
    if (!this.collection?.space || !this.auth.member$.value?.spaces?.[this.collection.space]?.totalReputation) {
      return 1;
    }

    const xp: number = this.auth.member$.value.spaces[this.collection.space].totalReputation || 0;
    let discount = 1;
    if (xp > 0) {
      for (const d of this.collection.discounts) {
        if (d.xp < xp) {
          discount = (1 - d.amount);
        }
      }
    }

    return discount;
  }

  public calc(amount: number, discount: number): number {
    let finalPrice = Math.ceil(amount * discount);
    if (finalPrice < MIN_AMOUNT_TO_TRANSFER) {
      finalPrice = MIN_AMOUNT_TO_TRANSFER;
    }

    finalPrice = Math.floor((finalPrice / 1000 / 10)) * 1000 * 10; // Max two decimals on Mi.
    return finalPrice;
  }

  public reset(): void {
    this.receivedTransactions = false;
    this.isOpen = false;
    this.currentStep = StepType.CONFIRM;
    this.purchasedNft = undefined;
    this.cd.markForCheck();
  }

  public goToNft(): void {
    this.router.navigate(['/', this.path, this.purchasedNft?.uid]);
    this.reset();
    this.wenOnClose.next();
  }

  public isExpired(val?: Transaction | null): boolean {
    if (!val?.createdOn) {
      return false;
    }

    const expiresOn: dayjs.Dayjs = dayjs(val.createdOn.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
    return expiresOn.isBefore(dayjs()) && val.type === TransactionType.ORDER;
  }

  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public formatBest(amount: number|undefined): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }

  public getRecord(): Nft|null|undefined {
    return this.purchasedNft || this.nft;
  }

  public fireflyDeepLink(): SafeUrl {
    if (!this.targetAddress || !this.targetAmount) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustUrl('iota://wallet/send/' + this.targetAddress +
           '?amount=' + (this.targetAmount / 1000 / 1000) + '&unit=Mi');
  }

  public tanglePayDeepLink(): SafeUrl {
    if (!this.targetAddress || !this.targetAmount) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustUrl('tanglepay://send/' + this.targetAddress + '?value=' + (this.targetAmount / 1000 / 1000) + '&unit=Mi' + '&merchant=Soonaverse');
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
        setItem(StorageItem.CheckoutTransaction, val.uid);
        this.transSubscription = this.orderApi.listen(val.uid).subscribe(<any>this.transaction$);
        this.pushToHistory(val.uid, dayjs(), 'Waiting for transaction...');
      });
    });
  }

  public getTitle(): any {
    if (!this.nft) {
      return '';
    }

    if (!this.purchasedNft) {
      if (this.nft.type === CollectionType.CLASSIC) {
        return this.nft.name;
      } else if (this.nft.type === CollectionType.GENERATED) {
        return $localize`Generated NFT`;
      } else if (this.nft.type === CollectionType.SFT) {
        return $localize`SFT`;
      }
    } else {
      return this.purchasedNft.name;
    }
  }

  public ngOnDestroy(): void {
    this.transSubscription?.unsubscribe();
  }
}
