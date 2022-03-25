import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { FileApi } from '@api/file.api';
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
import { ChartConfiguration, ChartType } from 'chart.js';
import * as dayjs from 'dayjs';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, interval, map, skip, Subscription, take } from 'rxjs';
import { DataService } from '../../services/data.service';
dayjs.extend(isSameOrBefore);

export enum ListingType {
  CURRENT_BIDS = 0,
  MY_BIDS = 1,
  MY_TRANSACTIONS = 2
}

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
  public isBidOpen = false;
  public isSaleOpen = false;
  public isCopied = false;
  public mediaType: 'video'|'image'|undefined;
  public isNftPreviewOpen = false;
  public currentListingType = ListingType.MY_TRANSACTIONS;
  public endsOnTicker$: BehaviorSubject<Timestamp|undefined> = new BehaviorSubject<Timestamp|undefined>(undefined);
  public lineChartType: ChartType = 'line';
  public lineChartData?: ChartConfiguration['data'];
  public lineChartOptions: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0
      }
    },
    scales: {
      xAxis: {
        ticks: {
          maxTicksLimit: 10
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  };
  private subscriptions$: Subscription[] = [];
  private nftSubscriptions$: Subscription[] = [];
  private collectionSubscriptions$: Subscription[] = [];
  private tranSubscriptions$: Subscription[] = [];

  constructor(
    public data: DataService,
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService,
    public auth: AuthService,
    private titleService: Title,
    private route: ActivatedRoute,
    private spaceApi: SpaceApi,
    private memberApi: MemberApi,
    private nzNotification: NzNotificationService,
    private collectionApi: CollectionApi,
    private nftApi: NftApi,
    private fileApi: FileApi,
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

      // Get file metadata.
      this.fileApi.getMetadata(obj.media).pipe(take(1), untilDestroyed(this)).subscribe((o) => {
        if (o.contentType.match('video/.*')) {
          this.mediaType = 'video';
        } else if (o.contentType.match('image/.*')) {
          this.mediaType = 'image';
        }

        this.cd.markForCheck();
      });
    });

    let lastNftId: undefined|string = undefined;
    this.data.nft$.pipe(skip(1), untilDestroyed(this)).subscribe(async (p) => {
      // TODO Only cause refresh if it's different to previous.
      if (p && p.uid !== lastNftId) {
        lastNftId = p.uid;
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

        if (this.auth.member$.value) {
          this.nftSubscriptions$.push(this.nftApi.getMembersTransactions(this.auth.member$.value, this.data.nft$.value!).pipe(untilDestroyed(this)).subscribe(this.data.myTransactions$));
        }
      }

      // Sync ticker.
      this.endsOnTicker$.next(p?.auctionFrom || undefined);
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

        if (this.auctionInProgress(this.data.nft$.value, p)) {
          this.currentListingType = ListingType.CURRENT_BIDS;
          this.cd.markForCheck();

          this.tranSubscriptions$.forEach((s) => {
            s.unsubscribe();
          });

          // Resubscribe.
          this.tranSubscriptions$.push(this.nftApi.getOffers(this.data.nft$.value!).pipe(untilDestroyed(this)).subscribe(this.data.allBidTransactions$));
          if (this.auth.member$.value) {
            this.tranSubscriptions$.push(this.nftApi.getMembersBids(this.auth.member$.value, this.data.nft$.value!).pipe(untilDestroyed(this)).subscribe(this.data.myBidTransactions$));
          }
        }
      }
    });

    this.data.orders$.pipe(untilDestroyed(this)).subscribe((obj) => {
          const arr: any = [];
          obj?.forEach((obj) => {
            arr.push([obj.order.createdOn?.toDate(), obj.order.payload.amount]);
          });

          this.initChart(arr);
    });

    interval(1000).pipe(untilDestroyed(this)).subscribe(() => {
      this.endsOnTicker$.next(this.endsOnTicker$.value);
      if (
        this.data.nft$.value &&
        (
          (this.data.nft$.value.availableFrom && dayjs(this.data.nft$.value.availableFrom.toDate()).diff(dayjs(), 's') === 0) ||
          (this.data.nft$.value.auctionFrom && dayjs(this.data.nft$.value.auctionFrom.toDate()).diff(dayjs(), 's') === 0)
        )

      ) {
        // Delay slightly.
        this.cd.markForCheck();
      }
    });
  }

  public getExplorerLink(link: string): string {
    return 'https://thetangle.org/search/' + link;
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

    return ((col.total - col.sold) > 0) && col.approved === true && !!nft?.availableFrom && dayjs(nft.availableFrom.toDate()).isSameOrBefore(dayjs(), 's');
  }

  public willBeAvailableForSale(nft?: Nft|null, col?: Collection|null): boolean {
    if (!col) {
      return false;
    }

    return col.approved === true && !!nft?.availableFrom && dayjs(nft.availableFrom.toDate()).isAfter(dayjs(), 's');
  }


  public canSetItForSale(nft?: Nft|null): boolean {
    return !!nft?.owner && nft?.owner === this.auth.member$.value?.uid;
  }

  public canBeSetForSale(nft?: Nft|null): boolean {
    if (nft?.auctionFrom || nft?.availableFrom) {
      return false;
    }

    return !!nft?.owner;
  }

  public isAvailableForAuction(nft?: Nft|null, col?: Collection|null): boolean {
    if (!col) {
      return false;
    }

    return col.approved === true && !!nft?.auctionFrom && dayjs(nft.auctionFrom.toDate()).isSameOrBefore(dayjs(), 's');
  }

  public willBeAvailableForAuction(nft?: Nft|null, col?: Collection|null): boolean {
    if (!col) {
      return false;
    }

    return col.approved === true && !!nft?.auctionFrom && dayjs(nft.auctionFrom.toDate()).isAfter(dayjs(), 's');
  }

  public auctionInProgress(nft?: Nft|null, col?: Collection|null): boolean {
    if (!col) {
      return false;
    }

    return (
      col.approved === true && !!nft?.auctionFrom && !!nft?.auctionTo &&
      dayjs(nft.auctionFrom.toDate()).isSameOrBefore(dayjs(), 's') &&
      dayjs(nft.auctionTo.toDate()).isAfter(dayjs(), 's')
    );
  }

  public saleNotStartedYet(nft?: Nft|null): boolean {
    if (!nft) {
      return false;
    }

    return dayjs(nft.availableFrom.toDate()).isAfter(dayjs(), 's')
  }

  public getAuctionEnd(nft?: Nft|null): dayjs.Dayjs|undefined {
    if (!nft?.auctionTo) {
      return;
    }

    return dayjs(nft.auctionTo.toDate());
  }

  public getAuctionEndHours(nft?: Nft|null): number {
    const expiresOn = this.getAuctionEnd(nft);
    if (!expiresOn) {
      return 0;
    }

    return expiresOn.diff(dayjs(), 'hour');
  }

  public getAuctionEndMin(nft?: Nft|null): number {
    const expiresOn = this.getAuctionEnd(nft);
    if (!expiresOn) {
      return 0;
    }

    let minutes = expiresOn.diff(dayjs(), 'minute');
    const hours = Math.floor(minutes / 60);
    minutes = minutes - (hours * 60);
    return minutes;
  }

  public getAuctionEndSec(nft?: Nft|null): number {
    const expiresOn = this.getAuctionEnd(nft);
    if (!expiresOn) {
      return 0;
    }

    let seconds = expiresOn.diff(dayjs(), 'seconds');
    const minutes = Math.floor(seconds / 60);
    seconds = seconds - (minutes * 60);
    return seconds;
  }

  public discount(collection?: Collection|null, nft?: Nft|null): number {
    if (!collection?.space || !this.auth.member$.value?.spaces?.[collection.space]?.totalReputation || nft?.owner) {
      return 1;
    }

    const xp: number = this.auth.member$.value.spaces[collection.space].totalReputation || 0;
    let discount = 1;
    if (xp > 0) {
      for (const d of collection.discounts.sort((a, b) => {
        return a.xp - b.xp;
      })) {
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

    finalPrice = Math.floor((finalPrice / 1000 / 10)) * 1000 * 10; // Max two decimals on Mi.
    return finalPrice;
  }

  public bid(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (getItem(StorageItem.CheckoutTransaction)) {
      this.nzNotification.error('You currently have open order. Pay for it or let it expire.', '');
      return;
    }
    this.isBidOpen = true;
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

  public sell(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.isSaleOpen = true;
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

  public getShareUrl(nft?: Nft | null): string {
    return nft?.wenUrlShort || nft?.wenUrl || window.location.href;
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

  public get listingTypes(): typeof ListingType {
    return ListingType;
  }

  public isDateInFuture(date?: Timestamp|null): boolean {
    if (!date) {
      return false;
    }

    return dayjs(date.toDate()).isAfter(dayjs(), 's');
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

  public initChart(data: any[][]): void {
    const dataToShow: { data: number[], labels: string[]} = {
      data: [],
      labels: []
    };

    if (data?.length) {
      const sortedData = data.sort((a, b) => a[0] - b[0]);
      for (let i=0; i<sortedData.length; i++) {
        dataToShow.data.push(sortedData[i][1] / 1000 / 1000);
        dataToShow.labels.push(dayjs(sortedData[i][0]).format('MMM D'));
      }
    }

    this.lineChartData = {
      datasets: [
        {
          data: dataToShow.data,
          backgroundColor: 'rgba(148,159,177,0.2)',
          borderColor: 'rgba(148,159,177,1)',
          pointBackgroundColor: 'rgba(148,159,177,1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(148,159,177,0.8)',
          fill: 'origin'
        }
      ],
      labels: dataToShow.labels
    };
    this.cd.markForCheck();
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
