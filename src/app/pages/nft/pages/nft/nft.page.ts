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
import { ChartOptions } from '@pages/member/pages/activity/activity.page';
import * as dayjs from 'dayjs';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, interval, map, skip, Subscription, take } from 'rxjs';
import { DataService } from '../../services/data.service';

export enum ListingType {
  // LISTING = 0,
  OFFER = 1
}

@UntilDestroy()
@Component({
  selector: 'wen-nft',
  templateUrl: './nft.page.html',
  styleUrls: ['./nft.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NFTPage implements OnInit, OnDestroy {
  public chartOptions: Partial<ChartOptions> = {};
  public collectionPath: string = ROUTER_UTILS.config.collection.root;
  public isCheckoutOpen = false;
  public isBidOpen = false;
  public isSaleOpen = false;
  public isCopied = false;
  public mediaType: 'video'|'image'|undefined;
  public isNftPreviewOpen = false;
  public currentListingType = ListingType.OFFER;
  public endsOnTicker$: BehaviorSubject<Timestamp|undefined> = new BehaviorSubject<Timestamp|undefined>(undefined);
  public listingsData = [
    { avatar: {fileName: "1911",metadata: "QmNV58Uhsi2wDgUsnuFxLdXVSJfs2fQGmxGy7gcowHQPEW",avatar: "bafybeiaa5kvb7ouratukbelczwcxxxdr6bql2qkrqkusei2l5z4ytccuam",original: "bafybeiauwiqc65rkkmv2r6bbmbphj3kflx6y2ldwlg2kldof3zewcbrzuq"}, from: 'ann', endsOn: '4/10/22', type: 'Auction', price: '200Mi'},
    { avatar: {fileName: "1911",metadata: "QmNV58Uhsi2wDgUsnuFxLdXVSJfs2fQGmxGy7gcowHQPEW",avatar: "bafybeiaa5kvb7ouratukbelczwcxxxdr6bql2qkrqkusei2l5z4ytccuam",original: "bafybeiauwiqc65rkkmv2r6bbmbphj3kflx6y2ldwlg2kldof3zewcbrzuq"}, from: 'ann', endsOn: '4/10/22', type: 'Auction', price: '200Mi'},
    { avatar: {fileName: "1911",metadata: "QmNV58Uhsi2wDgUsnuFxLdXVSJfs2fQGmxGy7gcowHQPEW",avatar: "bafybeiaa5kvb7ouratukbelczwcxxxdr6bql2qkrqkusei2l5z4ytccuam",original: "bafybeiauwiqc65rkkmv2r6bbmbphj3kflx6y2ldwlg2kldof3zewcbrzuq"}, from: 'ann', endsOn: '4/10/22', type: 'Auction', price: '200Mi'},
    { avatar: {fileName: "1911",metadata: "QmNV58Uhsi2wDgUsnuFxLdXVSJfs2fQGmxGy7gcowHQPEW",avatar: "bafybeiaa5kvb7ouratukbelczwcxxxdr6bql2qkrqkusei2l5z4ytccuam",original: "bafybeiauwiqc65rkkmv2r6bbmbphj3kflx6y2ldwlg2kldof3zewcbrzuq"}, from: 'ann', endsOn: '4/10/22', type: 'Auction', price: '200Mi'}
  ];
  public offersData = [
    { avatar: {fileName: "1911",metadata: "QmNV58Uhsi2wDgUsnuFxLdXVSJfs2fQGmxGy7gcowHQPEW",avatar: "bafybeiaa5kvb7ouratukbelczwcxxxdr6bql2qkrqkusei2l5z4ytccuam",original: "bafybeiauwiqc65rkkmv2r6bbmbphj3kflx6y2ldwlg2kldof3zewcbrzuq"}, from: 'ann', endsOn: '4/10/22', type: 'Auction', price: '200Mi'},
    { avatar: {fileName: "1911",metadata: "QmNV58Uhsi2wDgUsnuFxLdXVSJfs2fQGmxGy7gcowHQPEW",avatar: "bafybeiaa5kvb7ouratukbelczwcxxxdr6bql2qkrqkusei2l5z4ytccuam",original: "bafybeiauwiqc65rkkmv2r6bbmbphj3kflx6y2ldwlg2kldof3zewcbrzuq"}, from: 'ann', endsOn: '4/10/22', type: 'Auction', price: '200Mi'},
    { avatar: {fileName: "1911",metadata: "QmNV58Uhsi2wDgUsnuFxLdXVSJfs2fQGmxGy7gcowHQPEW",avatar: "bafybeiaa5kvb7ouratukbelczwcxxxdr6bql2qkrqkusei2l5z4ytccuam",original: "bafybeiauwiqc65rkkmv2r6bbmbphj3kflx6y2ldwlg2kldof3zewcbrzuq"}, from: 'ann', endsOn: '4/10/22', type: 'Auction', price: '200Mi'},
    { avatar: {fileName: "1911",metadata: "QmNV58Uhsi2wDgUsnuFxLdXVSJfs2fQGmxGy7gcowHQPEW",avatar: "bafybeiaa5kvb7ouratukbelczwcxxxdr6bql2qkrqkusei2l5z4ytccuam",original: "bafybeiauwiqc65rkkmv2r6bbmbphj3kflx6y2ldwlg2kldof3zewcbrzuq"}, from: 'ann', endsOn: '4/10/22', type: 'Auction', price: '200Mi'}
  ];
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

    return ((col.total - col.sold) > 0) && col.approved === true && !!nft?.availableFrom && dayjs(nft.availableFrom.toDate()).isBefore(dayjs());
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

    return col.approved === true && !!nft?.auctionFrom && dayjs(nft.auctionFrom.toDate()).isBefore(dayjs());
  }

  public saleNotStartedYet(nft?: Nft|null): boolean {
    if (!nft) {
      return false;
    }

    return dayjs(nft.availableFrom.toDate()).isAfter(dayjs())
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

  public initChart(data: any): void {
    this.chartOptions = {
      series: [
        {
          data: data
        }
      ],
      chart: {
        type: "area",
        height: 350
      },
      dataLabels: {
        enabled: false
      },
      markers: {
        size: 0
      },
      xaxis: {
        type: "datetime",
        min: data?.[0]?.[0].getTime(),
        tickAmount: 6
      },
      tooltip: {
        x: {
          format: "dd MMM yyyy"
        }
      },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.9,
          stops: [0, 100]
        }
      }
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
