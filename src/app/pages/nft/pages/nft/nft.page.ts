import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { MemberApi } from '@api/member.api';
import { NftApi, SuccesfullOrdersWithFullHistory } from '@api/nft.api';
import { SpaceApi } from '@api/space.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { getItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { copyToClipboard } from '@core/utils/tools.utils';
import { MIN_AMOUNT_TO_TRANSFER, WEN_NAME } from '@functions/interfaces/config';
import { Collection, CollectionType, TransactionBillPayment, TransactionType } from '@functions/interfaces/models';
import { FILE_SIZES, Timestamp } from '@functions/interfaces/models/base';
import { Nft } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { map, skip, Subscription } from 'rxjs';
import { DataService } from '../../services/data.service';

@UntilDestroy()
@Component({
  selector: 'wen-nft',
  templateUrl: './nft.page.html',
  styleUrls: ['./nft.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NFTPage implements OnInit, OnDestroy {
  public collectionPath: string = ROUTER_UTILS.config.collection.root;
  public isCheckoutOpen = false;
  public isCopied = false;
  public isNftPreviewOpen = false;
  private subscriptions$: Subscription[] = [];
  private nftSubscriptions$: Subscription[] = [];
  private collectionSubscriptions$: Subscription[] = [];
  constructor(
    public data: DataService,
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService,
    private titleService: Title,
    private route: ActivatedRoute,
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private memberApi: MemberApi,
    private nzNotification: NzNotificationService,
    private collectionApi: CollectionApi,
    private nftApi: NftApi,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {
    // none
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'NFT');
    this.route.params?.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.nft.nft.replace(':', '')];
      if (id) {
        this.listenToNft(id);
      } else {
        this.notFound();
      }
    });

    this.data.nft$.pipe(skip(1), untilDestroyed(this)).subscribe((obj: Nft|undefined) => {
      if (!obj) {
        this.notFound();
        return;
      }
    });

    this.data.nft$.pipe(skip(1), untilDestroyed(this)).subscribe(async (p) => {
      if (p) {
        this.nftSubscriptions$.forEach((s) => {
          s.unsubscribe();
        });
        this.nftSubscriptions$.push(this.spaceApi.listen(p.space).pipe(untilDestroyed(this)).subscribe(this.data.space$));
        this.nftSubscriptions$.push(this.collectionApi.listen(p.collection).pipe(untilDestroyed(this)).subscribe(this.data.collection$));
        this.nftSubscriptions$.push(this.nftApi.successfullOrders(p.uid).pipe(untilDestroyed(this)).subscribe(this.data.orders$));
        this.nftSubscriptions$.push(this.nftApi.positionInCollection(p.collection, undefined, undefined, 5).pipe(untilDestroyed(this)).subscribe(this.data.topNftWithinCollection$));
        if (p.createdBy) {
          this.nftSubscriptions$.push(this.memberApi.listen(p.createdBy).pipe(untilDestroyed(this)).subscribe(this.data.creator$));
        }
        if (p.owner) {
          this.nftSubscriptions$.push(this.memberApi.listen(p.owner).pipe(untilDestroyed(this)).subscribe(this.data.owner$));
        } else {
          this.data.owner$.next(undefined);
        }
        this.nftSubscriptions$.push(
          this.nftApi.lastCollection(p.collection, undefined, undefined, 1)?.pipe(untilDestroyed(this), map((obj: Nft[]) => {
            return obj[0];
          })).subscribe(this.data.firstNftInCollection$)
        );
      }
    });

    this.data.collection$.pipe(skip(1), untilDestroyed(this)).subscribe(async (p) => {
      if (p) {
        this.collectionSubscriptions$.forEach((s) => {
          s.unsubscribe();
        });
        this.collectionSubscriptions$.push(this.spaceApi.listen(p.royaltiesSpace).pipe(untilDestroyed(this)).subscribe(this.data.royaltySpace$));
        if (p.createdBy) {
          this.collectionSubscriptions$.push(this.memberApi.listen(p.createdBy).pipe(untilDestroyed(this)).subscribe(this.data.collectionCreator$));
        }
      }
    });
  }

  public getExplorerLink(link: string): string {
    return 'https://explorer.iota.org/mainnet/search/' + link;
  }

  public getOnChainInfo(orders?: SuccesfullOrdersWithFullHistory[]|null): string|undefined {
    if (!orders) {
      return undefined;
    }

    const lastestBill: TransactionBillPayment|undefined = this.getLatestBill(orders);
    return lastestBill?.payload?.chainReference || lastestBill?.payload?.walletReference?.chainReference || undefined;
  }

  public getLatestBill(orders?: SuccesfullOrdersWithFullHistory[]|null): TransactionBillPayment|undefined {
    if (!orders) {
      return undefined;
    }

    // Get all non royalty bills.
    let lastestBill: TransactionBillPayment|undefined = undefined;
    for (const h of orders) {
      for (const l of (h.transactions || [])) {
        if (
          l.type === TransactionType.BILL_PAYMENT &&
          l.payload.royalty === false &&
          l.payload.reconciled === true &&
          (!lastestBill || dayjs(lastestBill.createdOn?.toDate()).isBefore(l.createdOn?.toDate()))
        ) {
          lastestBill = l;
        }
      }
    }

    return lastestBill;
  }

  private listenToNft(id: string): void {
    this.cancelSubscriptions();
    this.data.nftId = id;
    this.subscriptions$.push(this.nftApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.data.nft$));
  }

  public isAvailableForSale(nft?: Nft|null, col?: Collection|null): boolean {
    if (!col) {
      return false;
    }

    return ((col.total - col.sold) > 0) && col.approved === true && !!nft?.availableFrom && dayjs(nft.availableFrom.toDate()).isBefore(dayjs()) && !nft?.owner;
  }

  public saleNotStartedYet(nft?: Nft|null): boolean {
    if (!nft) {
      return false;
    }

    return dayjs(nft.availableFrom.toDate()).isAfter(dayjs())
  }

  public discount(collection?: Collection|null): number {
    if (!collection?.space || !this.auth.member$.value?.spaces?.[collection.space]?.totalReputation) {
      return 1;
    }

    const xp: number = this.auth.member$.value.spaces[collection.space].totalReputation || 0;
    let discount = 1;
    if (xp > 0) {
      for (const d of collection.discounts) {
        if (d.xp < xp) {
          discount = (1 - d.amount);
        }
      }
    }

    return discount;
  }

  public calc(amount: number | null | undefined, discount: number): number {
    let finalPrice = Math.ceil((amount || 0) * discount);
    if (finalPrice < MIN_AMOUNT_TO_TRANSFER) {
      finalPrice = MIN_AMOUNT_TO_TRANSFER;
    }

    return finalPrice;
  }

  public buy(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (getItem(StorageItem.CheckoutTransaction)) {
      this.nzNotification.error('You currently have open order. Pay for it or let it expire.', '');
      return;
    }
    this.isCheckoutOpen = true;
  }

  public copy(): void {
    if (!this.isCopied) {
      copyToClipboard(window.location.href);
      this.isCopied = true;
      setTimeout(() => {
        this.isCopied = false;
        this.cd.markForCheck();
      }, 3000);
    }
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public getShareUrl(): string {
    return 'http://twitter.com/share?text=Check out collection&url=' + window.location.href + '&hashtags=soonaverse';
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public isDateInFuture(date?: Timestamp|null): boolean {
    if (!date) {
      return false;
    }

    return dayjs(date.toDate()).isAfter(dayjs());
  }

  public getTitle(nft?: Nft|null): any {
    if (!nft) {
      return '';
    }

    if (!nft.owner) {
      if (nft.type === CollectionType.CLASSIC) {
        return nft.name;
      } else if (nft.type === CollectionType.GENERATED) {
        return 'Generated NFT';
      } else if (nft.type === CollectionType.SFT) {
        return 'SFT';
      }
    } else {
      return nft.name;
    }
  }

  public generatedNft(nft?: Nft|null): boolean {
    if (!nft) {
      return false;
    }

    return (!nft.owner && (nft.type === CollectionType.GENERATED || nft.type === CollectionType.SFT));
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.data.reset();
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.cancelSubscriptions();
    this.nftSubscriptions$.forEach((s) => {
      s.unsubscribe();
    });
    this.collectionSubscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }
}
