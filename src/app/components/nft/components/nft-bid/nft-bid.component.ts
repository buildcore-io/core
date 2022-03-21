import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FileApi } from '@api/file.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { copyToClipboard } from '@core/utils/tools.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { MIN_AMOUNT_TO_TRANSFER } from '@functions/interfaces/config';
import { Collection, CollectionType, Transaction } from '@functions/interfaces/models';
import { Nft } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import dayjs from 'dayjs';
import { BehaviorSubject, take } from 'rxjs';

export enum StepType {
  CONFIRM = 'Confirm',
  TRANSACTION = 'Transaction',
  WAIT = 'Wait'
}

interface TransactionItem {
  uniqueId: string;
  date: Date;
  action: 'Bid' | 'Refund';
  amount: number;
  link?: string
}

@UntilDestroy()
@Component({
  selector: 'wen-nft-bid',
  templateUrl: './nft-bid.component.html',
  styleUrls: ['./nft-bid.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftBidComponent {
  @Input() currentStep = StepType.CONFIRM;
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
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
  
  public transaction$: BehaviorSubject<Transaction|undefined> = new BehaviorSubject<Transaction|undefined>(undefined);
  public expiryTicker$: BehaviorSubject<dayjs.Dayjs|null> = new BehaviorSubject<dayjs.Dayjs|null>(null);
  public stepType = StepType;
  public isCopied = false;
  public agreeTermsConditions = false;
  public mediaType: 'video'|'image'|undefined;
  // @TODO: Remove
  public targetAddress?: string = '123123123123123123123123123123123123123123123123';
  public targetAmount?: number;
  public invalidPayment = false;
  // TODO Remove
  public transactions: TransactionItem[] = [
    {date: new Date(), action: 'Bid', amount: 5000000, link: 'https://www.google.com/', uniqueId: '1'},
    {date: new Date(), action: 'Refund', amount: 5000000, link: 'https://www.google.com/', uniqueId: '2'},
    {date: new Date(), action: 'Bid', amount: 5000000, link: 'https://www.google.com/', uniqueId: '3'},
    {date: new Date(), action: 'Refund', amount: 5000000, link: 'https://www.google.com/', uniqueId: '4'},
    {date: new Date(), action: 'Bid', amount: 5000000, link: 'https://www.google.com/', uniqueId: '5'},
    {date: new Date(), action: 'Refund', amount: 5000000, link: 'https://www.google.com/', uniqueId: '6'},
    {date: new Date(), action: 'Bid', amount: 5000000, link: 'https://www.google.com/', uniqueId: '7'},
    {date: new Date(), action: 'Refund', amount: 5000000, link: 'https://www.google.com/', uniqueId: '8'},
    {date: new Date(), action: 'Bid', amount: 5000000, link: 'https://www.google.com/', uniqueId: '9'},
    {date: new Date(), action: 'Refund', amount: 5000000, link: 'https://www.google.com/', uniqueId: '10'},
    {date: new Date(), action: 'Bid', amount: 5000000, link: 'https://www.google.com/', uniqueId: '11'},
    {date: new Date(), action: 'Refund', amount: 5000000, link: 'https://www.google.com/', uniqueId: '12'},
    {date: new Date(), action: 'Bid', amount: 5000000, link: 'https://www.google.com/', uniqueId: '13'}
  ];
  private _isOpen = false;
  private _nft?: Nft|null;

  constructor(
    public deviceService: DeviceService,
    private cd: ChangeDetectorRef,
    private fileApi: FileApi,
    private auth: AuthService,
    private sanitizer: DomSanitizer
  ) {}

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

  public formatBest(amount: number|undefined): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }

  public getRecord(): Nft|null|undefined {
    return this.nft;
  }

  public reset(): void {
    this.isOpen = false;
    this.currentStep = StepType.CONFIRM;
    this.cd.markForCheck();
  }
  
  public close(): void {
    this.reset();
    this.wenOnClose.next();
  }

  public getTitle(): any {
    if (!this.nft) {
      return '';
    }

    if (this.nft.type === CollectionType.CLASSIC) {
      return this.nft.name;
    } else if (this.nft.type === CollectionType.GENERATED) {
      return $localize`Generated NFT`;
    } else if (this.nft.type === CollectionType.SFT) {
      return $localize`SFT`;
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
  
  // TODO
  public isExpired(val?: Transaction | null): boolean {
    return false;
    // if (!val?.createdOn) {
    //   return false;
    // }

    // const expiresOn: dayjs.Dayjs = dayjs(val.createdOn.toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms');
    // return expiresOn.isBefore(dayjs()) && val.type === TransactionType.ORDER;
  }

  // TODO
  public async proceedWithBid(): Promise<void> {
    return;
    // if (!this.collection || !this.nft || !this.agreeTermsConditions) {
    //   return;
    // }

    // const params: any = {
    //   collection: this.collection.uid
    // };

    // if (this.collection.type === CollectionType.CLASSIC) {
    //   params.nft = this.nft.uid;
    // }

    // // If owner is set CollectionType is not relevant.
    // if (this.nft.owner) {
    //   params.nft = this.nft.uid;
    // }

    // await this.auth.sign(params, (sc, finish) => {
    //   this.notification.processRequest(this.orderApi.orderNft(sc), 'Order created.', finish).subscribe((val: any) => {
    //     this.transSubscription?.unsubscribe();
    //     setItem(StorageItem.CheckoutTransaction, val.uid);
    //     this.transSubscription = this.orderApi.listen(val.uid).subscribe(<any>this.transaction$);
    //     this.pushToHistory(val.uid, dayjs(), 'Waiting for transaction...');
    //   });
    // });
  }
  
  public trackByUniqueId(index: number, item: any): number {
    return item.uniqueId;
  }

  public getExplorerLink(link: string): string {
    return 'https://thetangle.org/search/' + link;
  }
}
