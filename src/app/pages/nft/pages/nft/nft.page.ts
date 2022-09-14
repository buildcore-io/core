import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { FileApi } from '@api/file.api';
import { MemberApi } from '@api/member.api';
import { NftApi, OffersHistory, SuccesfullOrdersWithFullHistory } from '@api/nft.api';
import { SpaceApi } from '@api/space.api';
import { AuthService } from '@components/auth/services/auth.service';
import { TimelineItem, TimelineItemType } from '@components/timeline/timeline.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { SeoService } from '@core/services/seo';
import { ThemeList, ThemeService } from '@core/services/theme';
import { TransactionService } from '@core/services/transaction';
import { UnitsService } from '@core/services/units';
import { getItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { copyToClipboard } from '@core/utils/tools.utils';
import { MIN_AMOUNT_TO_TRANSFER } from '@functions/interfaces/config';
import { Collection, CollectionType, Network, Space, Transaction } from '@functions/interfaces/models';
import { FILE_SIZES, Timestamp } from '@functions/interfaces/models/base';
import { Nft } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HelperService } from '@pages/nft/services/helper.service';
import { ChartConfiguration, ChartType } from 'chart.js';
import * as dayjs from 'dayjs';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, combineLatest, interval, map, skip, Subscription, take } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DataService } from '../../services/data.service';

export enum ListingType {
  CURRENT_BIDS = 0,
  PAST_BIDS = 1,
  MY_BIDS = 2
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
  public mediaType: 'video' | 'image' | undefined;
  public isNftPreviewOpen = false;
  public currentListingType = ListingType.MY_BIDS;
  public endsOnTicker$: BehaviorSubject<Timestamp | undefined> = new BehaviorSubject<Timestamp | undefined>(undefined);
  public lineChartType: ChartType = 'line';
  public lineChartData?: ChartConfiguration['data'];
  public lineChartOptions?: ChartConfiguration['options'] = {}
  public systemInfoLabels: string[] = [
    $localize`On-Chain Record`,
    $localize`Migrate`,
    $localize`IPFS Metadata`,
    $localize`IPFS Image`
  ];
  public systemInfoValues: { [key: string]: string } = {
    preparing: $localize`Preparing...`,
    view: $localize`View`,
    tokenization: $localize`Shimmer/Mainnet (Tokenization)...SOON.`
  };
  private subscriptions$: Subscription[] = [];
  private nftSubscriptions$: Subscription[] = [];
  private collectionSubscriptions$: Subscription[] = [];
  private tranSubscriptions$: Subscription[] = [];

  constructor(
    public data: DataService,
    public helper: HelperService,
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService,
    public auth: AuthService,
    public unitsService: UnitsService,
    public transactionService: TransactionService,
    private route: ActivatedRoute,
    private spaceApi: SpaceApi,
    private memberApi: MemberApi,
    private nzNotification: NzNotificationService,
    private collectionApi: CollectionApi,
    private nftApi: NftApi,
    private fileApi: FileApi,
    private router: Router,
    private cache: CacheService,
    private cd: ChangeDetectorRef,
    private themeService: ThemeService,
    private seo: SeoService
  ) {
    // none
  }

  public ngOnInit(): void {
    this.route.params?.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string | undefined = obj?.[ROUTER_UTILS.config.nft.nft.replace(':', '')];
      if (id) {
        this.listenToNft(id);

        if (this.cache.openCheckout) {
          this.cache.openCheckout = false;
          // We open checkout with or auction with delay.
          setTimeout(() => {
            // You can't self buy.
            if (this.auth.member$.value?.uid && this.data.nft$.value?.owner === this.auth.member$.value?.uid) {
              return;
            }

            if (this.helper.isAvailableForAuction(this.data.nft$.value, this.data.collection$.value)) {
              this.bid();
              this.cd.markForCheck();
            } else if (this.helper.isAvailableForSale(this.data.nft$.value, this.data.collection$.value)) {
              this.buy();
              this.cd.markForCheck();
            }
          }, 1500);
        }
      } else {
        this.notFound();
      }
    });

    this.data.nft$.pipe(skip(1), untilDestroyed(this)).subscribe((obj: Nft | undefined) => {
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

        this.seo.setTags(
          'NFT - ' + obj.name,
          obj.description,
          this.mediaType === 'image' ? obj.media : undefined
        );

        this.cd.markForCheck();
      });
    });

    let lastNftId: undefined | string = undefined;
    let lastOwner: undefined | string = undefined;
    this.data.nft$.pipe(skip(1), untilDestroyed(this)).subscribe(async(p) => {
      // TODO Only cause refresh if it's different to previous.
      if (p && (p.uid !== lastNftId || p.owner !== lastOwner)) {
        lastNftId = p.uid;
        lastOwner = p.owner;
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

      if (this.auth.member$.value && this.data.nft$.value) {
        this.data.pastBidTransactionsLoading$.next(true);
        this.nftSubscriptions$.push(this.nftApi.getMembersBids(this.auth.member$.value, this.data.nft$.value!)
          .pipe(untilDestroyed(this))
          .subscribe((value: Transaction[]) => {
            this.currentListingType = ListingType.PAST_BIDS;
            this.data.pastBidTransactions$.next(value);
            this.data.pastBidTransactionsLoading$.next(false);
          }));
      }

      // Sync ticker.
      this.endsOnTicker$.next(p?.auctionFrom || undefined);
    });

    this.data.collection$.pipe(skip(1), untilDestroyed(this)).subscribe(async(p) => {
      if (p) {
        this.collectionSubscriptions$.forEach((s) => {
          s.unsubscribe();
        });
        this.collectionSubscriptions$.push(this.spaceApi.listen(p.royaltiesSpace).pipe(untilDestroyed(this)).subscribe(this.data.royaltySpace$));
        if (p.createdBy) {
          this.collectionSubscriptions$.push(this.memberApi.listen(p.createdBy).pipe(untilDestroyed(this)).subscribe(this.data.collectionCreator$));
        }

        this.refreshBids();
      }
    });

    combineLatest([this.data.orders$, this.themeService.theme$])
      .pipe(
        filter(([obj, theme]) => !!obj && !!theme),
        untilDestroyed(this)
      )
      .subscribe(([obj, theme]) => {
        const arr: any = [];
        obj?.forEach((obj) => {
          arr.push([obj.order.createdOn?.toDate(), obj.order.payload.amount]);
        });

        switch (theme) {
        case ThemeList.Light:
          this.setLineChartOptions('#959388', '#fff', '#333');
          this.initChart(arr, {
            backgroundColor: '#FCFBF9',
            borderColor: '#F39200',
            pointBackgroundColor: '#F39200',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#333',
            pointHoverBorderColor: '#fff'
          });
          break;
        case ThemeList.Dark:
          this.setLineChartOptions('#6A6962', '#333', '#fff');
          this.initChart(arr, {
            backgroundColor: '#232323',
            borderColor: '#F39200',
            pointBackgroundColor: '#F39200',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#333',
            pointHoverBorderColor: '#fff'
          });
          break;
        }
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

      // Make sure we refresh bids once auction is in progress.
      if (this.tranSubscriptions$.length === 0) {
        this.refreshBids();
      }
    });
  }

  private refreshBids(): void {
    if (this.helper.auctionInProgress(this.data.nft$.value, this.data.collection$.value)) {
      this.currentListingType = ListingType.CURRENT_BIDS;
      this.cd.markForCheck();

      this.tranSubscriptions$.forEach((s) => {
        s.unsubscribe();
      });
      this.tranSubscriptions$ = [];
      // Resubscribe.

      if (this.data.nft$.value) {
        this.data.allBidTransactionsLoading$.next(true);
        this.tranSubscriptions$.push(this.nftApi.getOffers(this.data.nft$.value!)
          .pipe(untilDestroyed(this))
          .subscribe((value: OffersHistory[]) => {
            this.data.allBidTransactions$.next(value);
            this.data.allBidTransactionsLoading$.next(false);
          }));

        if (this.auth.member$.value) {
          this.data.myBidTransactionsLoading$.next(true);
          this.tranSubscriptions$.push(this.nftApi.getMembersBids(this.auth.member$.value, this.data.nft$.value!, true)
            .pipe(untilDestroyed(this))
            .subscribe((value: Transaction[]) => {
              this.data.myBidTransactions$.next(value);
              this.data.myBidTransactionsLoading$.next(false);
            }));
        }
      }
    }
  }

  private listenToNft(id: string): void {
    this.cancelSubscriptions();
    this.data.nftId = id;
    this.subscriptions$.push(this.nftApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.data.nft$));
  }

  public canSetItForSale(nft?: Nft | null): boolean {
    return !!nft?.owner && nft?.owner === this.auth.member$.value?.uid;
  }

  public discount(collection?: Collection|null, nft?: Nft|null): number {
    if (!collection?.space || !this.auth.member$.value || nft?.owner) {
      return 1;
    }

    const xp: number = this.auth.member$.value.spaces?.[collection.space]?.totalReputation || 0;
    let discount = 1;
    for (const d of collection.discounts.sort((a, b) => {
      return a.xp - b.xp;
    })) {
      if (d.xp < xp) {
        discount = (1 - d.amount);
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

  public bid(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (getItem(StorageItem.CheckoutTransaction)) {
      this.nzNotification.error('You currently have open order. Pay for it or let it expire.', '');
      return;
    }
    this.isBidOpen = true;
  }

  public buy(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (getItem(StorageItem.CheckoutTransaction)) {
      this.nzNotification.error('You currently have open order. Pay for it or let it expire.', '');
      return;
    }
    this.isCheckoutOpen = true;
  }

  public get networkTypes(): typeof Network {
    return Network;
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

  public isLoading(arr: Nft[] | null | undefined): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: Nft[] | null | undefined): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  public trackByUid(index: number, item: Nft) {
    return item.uid;
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public get listingTypes(): typeof ListingType {
    return ListingType;
  }

  public getTitle(nft?: Nft | null): any {
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

  public generatedNft(nft?: Nft | null): boolean {
    if (!nft) {
      return false;
    }

    return (!nft.owner && (nft.type === CollectionType.GENERATED || nft.type === CollectionType.SFT));
  }

  private setLineChartOptions(axisColor: string, tooltipColor: string, tooltipBackgroundColor: string): void {
    this.lineChartOptions = {
      elements: {
        line: {
          tension: 0
        }
      },
      scales: {
        xAxis: {
          ticks: {
            maxTicksLimit: 10,
            color: axisColor,
            font: {
              size: 14,
              weight: '600',
              family: 'Poppins',
              lineHeight: '14px'
            }
          }
        },
        yAxis: {
          ticks: {
            maxTicksLimit: 10,
            color: axisColor,
            font: {
              size: 14,
              weight: '600',
              family: 'Poppins',
              lineHeight: '14px'
            }
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          xAlign: 'center',
          yAlign: 'bottom',
          backgroundColor: tooltipBackgroundColor,
          titleColor: 'rgba(0,0,0,0)',
          titleSpacing: 0,
          titleMarginBottom: 0,
          titleFont: {
            lineHeight: 0
          },
          bodyColor: tooltipColor,
          bodyFont: {
            weight: '500',
            family: 'Poppins',
            size: 16,
            lineHeight: '28px'
          },
          bodyAlign: 'center',
          bodySpacing: 0,
          borderColor: 'rgba(0, 0, 0, 0.2)',
          borderWidth: 1,
          footerMarginTop: 0,
          caretPadding: 16,
          caretSize: 2,
          displayColors: false
        }
      }
    };
    this.cd.markForCheck();
  }

  private initChart(data: any[][], colorOptions: object): void {
    const dataToShow: { data: number[]; labels: string[] } = {
      data: [],
      labels: []
    };

    if (data?.length) {
      const sortedData = data.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < sortedData.length; i++) {
        dataToShow.data.push(sortedData[i][1] / 1000 / 1000);
        dataToShow.labels.push(dayjs(sortedData[i][0]).format('MMM D'));
      }
    }

    this.lineChartData = {
      datasets: [
        {
          data: dataToShow.data,
          fill: 'origin',
          ...colorOptions
        }
      ],
      labels: dataToShow.labels
    };
    this.cd.markForCheck();
  }

  public getTimelineItems(nft?: Nft | null, space?: Space | null, orders?: SuccesfullOrdersWithFullHistory[] | null): TimelineItem[] {
    const res: TimelineItem[] =
      orders
        ?.map(order => ({
          type: TimelineItemType.ORDER,
          payload: {
            image: order.newMember.currentProfileImage,
            date: order.order.createdOn?.toDate(),
            name: order.newMember.name || order.newMember.uid,
            amount: order.order.payload.amount,
            transactions: order.transactions
          }
        })) || [];

    if (nft?.owner && (nft?.availableFrom || nft?.auctionFrom)) {
      res.unshift({
        type: TimelineItemType.LISTED_BY_MEMBER,
        payload: {
          image: this.data.owner$.value?.currentProfileImage,
          date: (nft?.availableFrom || nft?.auctionFrom)?.toDate(),
          isAuction: !!(!nft?.availableFrom && nft?.auctionFrom),
          name: this.data.owner$.value?.name || this.data.owner$.value?.uid || ''
        }
      });
    }

    if (space) {
      res.push({
        type: TimelineItemType.LISTED_BY_SPACE,
        payload: {
          image: space.avatarUrl,
          date: nft?.createdOn?.toDate(),
          name: space.name || space.uid || ''
        }
      });
    }

    return res || [];
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.data.reset();
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
    this.nftSubscriptions$.forEach((s) => {
      s.unsubscribe();
    });
    this.collectionSubscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }
}
