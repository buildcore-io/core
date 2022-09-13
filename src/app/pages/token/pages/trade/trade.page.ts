import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { FULL_LIST } from '@api/base.api';
import { SpaceApi } from '@api/space.api';
import { TokenApi } from '@api/token.api';
import { TokenMarketApi } from '@api/token_market.api';
import { TokenPurchaseApi } from '@api/token_purchase.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { PreviewImageService } from '@core/services/preview-image';
import { ThemeList, ThemeService } from '@core/services/theme';
import { NETWORK_DETAIL, UnitsService } from '@core/services/units';
import { getItem, setItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { DEFAULT_NETWORK, MIN_AMOUNT_TO_TRANSFER, SERVICE_MODULE_FEE_TOKEN_EXCHANGE, WEN_NAME } from '@functions/interfaces/config';
import { Member, Network, Space } from '@functions/interfaces/models';
import { FILE_SIZES, Timestamp } from '@functions/interfaces/models/base';
import { Token, TokenDistribution, TokenPurchase, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from "@functions/interfaces/models/token";
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
import { HelperService } from '@pages/token/services/helper.service';
import { ChartConfiguration, ChartType } from 'chart.js';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import updateLocale from 'dayjs/plugin/updateLocale';
dayjs.extend(relativeTime);
dayjs.extend(updateLocale)

import bigDecimal from 'js-big-decimal';
import { BehaviorSubject, combineLatest, filter, first, interval, map, merge, Observable, of, skip, Subscription, timer } from 'rxjs';

export enum ChartLengthType {
  DAY = '24h',
  WEEK = '7d',
}

export enum AskListingType {
  OPEN = 'OPEN',
  MY = 'MY'
}

export enum BidListingType {
  OPEN = 'OPEN',
  MY = 'MY'
}

export enum MyTradingType {
  BIDS = 'BIDS',
  ASKS = 'ASKS',
  HISTORY = 'HISTORY'
}

export enum TradeFormState {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum PriceOptionType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT'
}

export enum MobileViewState {
  ORDER_BOOK = 'ORDER_BOOK',
  TOKEN_CHART = 'TOKEN_CHART',
  TRADE_HISTORY = 'TRADE_HISTORY'
}

export interface TransformedBidAskItem {
  price: number;
  amount: number;
  isOwner: boolean;
}

export const ORDER_BOOK_OPTIONS = [0.1, 0.01, 0.001];
const MAXIMUM_ORDER_BOOK_ROWS = 9;

@UntilDestroy()
@Component({
  selector: 'wen-trade',
  templateUrl: './trade.page.html',
  styleUrls: ['./trade.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradePage implements OnInit, OnDestroy {
  public chartLengthOptions = [
    { label: $localize`24h`, value: ChartLengthType.DAY },
    { label: $localize`7d`, value: ChartLengthType.WEEK }
  ];
  public bids$: BehaviorSubject<TokenTradeOrder[]> = new BehaviorSubject<TokenTradeOrder[]>([]);
  public myBids$: BehaviorSubject<TokenTradeOrder[]> = new BehaviorSubject<TokenTradeOrder[]>([]);
  public asks$: BehaviorSubject<TokenTradeOrder[]> = new BehaviorSubject<TokenTradeOrder[]>([]);
  public myAsks$: BehaviorSubject<TokenTradeOrder[]> = new BehaviorSubject<TokenTradeOrder[]>([]);
  public sortedBids$ = new BehaviorSubject<TransformedBidAskItem[]>([] as TransformedBidAskItem[]);
  public sortedAsks$ = new BehaviorSubject<TransformedBidAskItem[]>([] as TransformedBidAskItem[]);
  public bidsAmountHighest$: Observable<number>;
  public asksAmountHighest$: Observable<number>;
  public myOpenBids$: Observable<TokenTradeOrder[]>;
  public myOpenAsks$: Observable<TokenTradeOrder[]>;
  public myOrderHistory$: Observable<TokenTradeOrder[]>;
  public buySellPriceDiff$: Observable<number> = of(0);
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(undefined);
  public listenAvgSell$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenAvgBuy$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenAvgPrice24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenToPurchases24h$: BehaviorSubject<TokenPurchase[]> = new BehaviorSubject<TokenPurchase[]>([]);
  public listenToPurchases7d$: BehaviorSubject<TokenPurchase[]> = new BehaviorSubject<TokenPurchase[]>([]);
  public listenAvgPrice7d$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  // public listenVolume24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  // public listenVolume7d$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenChangePrice24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public tradeHistory$: BehaviorSubject<TokenPurchase[]> = new BehaviorSubject<TokenPurchase[]>([]);
  public chartLengthControl: FormControl = new FormControl(ChartLengthType.DAY, Validators.required);
  public memberDistribution$?: BehaviorSubject<TokenDistribution | undefined> = new BehaviorSubject<TokenDistribution | undefined>(undefined);
  public currentAskListing = AskListingType.OPEN;
  public currentBidsListing = BidListingType.OPEN;
  public currentMyTradingState = MyTradingType.BIDS;
  public currentMobileViewState = MobileViewState.ORDER_BOOK;
  public currentTradeFormState$ = new BehaviorSubject<TradeFormState>(TradeFormState.BUY);
  public isFavourite = false;
  public orderBookOptions = ORDER_BOOK_OPTIONS;
  public orderBookOptionControl = new FormControl(ORDER_BOOK_OPTIONS[2]);
  public orderBookOption$: BehaviorSubject<number> = new BehaviorSubject<number>(ORDER_BOOK_OPTIONS[2]);
  public currentDate = dayjs();
  public defaultNetwork = DEFAULT_NETWORK;
  public maximumOrderBookRows = MAXIMUM_ORDER_BOOK_ROWS;
  public priceOption$ = new BehaviorSubject<PriceOptionType>(PriceOptionType.LIMIT);
  public amountControl: FormControl = new FormControl();
  public priceControl: FormControl = new FormControl();
  public dummyControl = new FormControl({ value: undefined, disabled: true });
  public lineChartType: ChartType = 'line';
  public lineChartData?: ChartConfiguration['data'] = {
    datasets: [],
    labels: []
  };
  public lineChartOptions?: ChartConfiguration['options'] = {};
  public isBidTokenOpen = false;
  public isAskTokenOpen = false;
  public cancelTradeOrder: TokenTradeOrder | null = null;
  public tradeDetailOrder: TokenTradeOrder | null = null;
  public tradeDetailPurchases: TokenPurchase[] | TokenPurchase | null = null;
  public isTradeDrawerVisible = false;
  private subscriptions$: Subscription[] = [];
  private subscriptionsMembersBids$: Subscription[] = [];
  private memberDistributionSub$?: Subscription;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public data: DataService,
    public auth: AuthService,
    public helper: HelperService,
    public unitsService: UnitsService,
    private titleService: Title,
    private tokenApi: TokenApi,
    private cd: ChangeDetectorRef,
    private tokenPurchaseApi: TokenPurchaseApi,
    private notification: NotificationService,
    private tokenMarketApi: TokenMarketApi,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute,
    private themeService: ThemeService
  ) {
    this.bidsAmountHighest$ = this.sortedBids$.asObservable().pipe(map(r => Math.max(...r.map(o => o.amount))));
    this.asksAmountHighest$ = this.sortedAsks$.asObservable().pipe(map(r => Math.max(...r.map(o => o.amount))));

    this.myOpenBids$ = this.myBids$.asObservable().pipe(map(r =>
      r.filter(e => e.status === this.bidAskStatuses.ACTIVE)));
    this.myOpenAsks$ = this.myAsks$.asObservable().pipe(map(r =>
      r.filter(e => e.status === this.bidAskStatuses.ACTIVE)));
    this.myOrderHistory$ = combineLatest([this.myBids$, this.myAsks$]).pipe(map(([bids, asks]) =>
      [...(bids || []), ...(asks || [])].filter(e => e.status !== this.bidAskStatuses.ACTIVE).sort((a, b) => (b?.createdOn?.toMillis() || 0) - (a?.createdOn?.toMillis() || 0))));

    this.buySellPriceDiff$ =
      combineLatest([this.sortedBids$, this.sortedAsks$])
        .pipe(
          map(([bids, asks]) => {
            // Never allow negative.
            const amount: number = asks.length > 0 && bids.length > 0 ? +bigDecimal.subtract(asks[asks.length - 1].price, bids[0].price) : 0;
            if (amount < 0) {
              return 0;
            }

            return amount;
          })
        );
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + $localize`Token Trading`);
    this.route.params?.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string | undefined = obj?.[ROUTER_UTILS.config.token.token.replace(':', '')];
      if (id) {
        this.listenToToken(id);
        this.listenToTrades(id);
        this.listenToStats(id);
      }
    });

    this.data.token$.pipe(skip(1), first()).subscribe((t) => {
      if (t) {
        this.subscriptions$.push(this.spaceApi.listen(t.space).pipe(untilDestroyed(this)).subscribe(this.data.space$));
        this.listenToMemberSubs(this.auth.member$.value);
        this.isFavourite = ((getItem(StorageItem.FavouriteTokens) as string[]) || []).includes(t.uid);
        const selectedTradePriceOptions = (getItem(StorageItem.SelectedTradePriceOption) || {}) as { [key: string]: PriceOptionType };
        this.priceOption$.next(selectedTradePriceOptions[t.uid] || PriceOptionType.LIMIT);
        this.cd.markForCheck();
      }
    });

    this.auth.member$?.pipe(untilDestroyed(this)).subscribe((member) => {
      this.listenToMemberSubs(member);
    });

    merge(
      this.chartLengthControl.valueChanges,
      this.listenToPurchases24h$,
      this.listenToPurchases7d$,
      this.themeService.theme$,
      timer(750)
    ).pipe(untilDestroyed(this)).subscribe(() => {
      switch (this.themeService.theme$.value) {
      case ThemeList.Light:
        this.setLineChartOptions('#959388', '#fff', '#333');
        this.refreshDataSets({
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
        this.refreshDataSets({
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
      this.currentDate = dayjs();
      this.cd.markForCheck();
    });

    combineLatest([this.bids$.asObservable(), this.orderBookOption$])
      .pipe(
        map(([bids]) => bids),
        map(r => this.groupOrders.call(this, r)),
        map(r =>
          Object.values(r.map(e => {
            const transformedPrice = bigDecimal.multiply(bigDecimal.floor(bigDecimal.divide(e.price, this.orderBookOption$.value, 1000)), this.orderBookOption$.value);
            return { ...e, price: Number(transformedPrice) };
          }).reduce((acc, e) => {
            if (!acc[e.price]) {
              return { ...acc, [e.price]: e };
            } else {
              return { ...acc, [e.price]: { ...acc[e.price], amount: Number(bigDecimal.add(acc[e.price].amount, e.amount)) } };
            }
          }, {} as { [key: string]: TransformedBidAskItem })),
        ),
        map(r => r.sort((a, b) => b.price - a.price)),
        map(r => r.slice(0, this.maximumOrderBookRows)),
        untilDestroyed(this)
      ).subscribe(this.sortedBids$);

    combineLatest([this.asks$.asObservable(), this.orderBookOption$])
      .pipe(
        map(([asks]) => asks),
        map(r => this.groupOrders.call(this, r)),
        map(r =>
          Object.values(r.map(e => {
            const transformedPrice = bigDecimal.multiply(bigDecimal.ceil(bigDecimal.divide(e.price, this.orderBookOption$.value, 1000)), this.orderBookOption$.value);
            return { ...e, price: Number(transformedPrice) };
          }).reduce((acc, e) => {
            if (!acc[e.price]) {
              return { ...acc, [e.price]: e };
            } else {
              return { ...acc, [e.price]: { ...acc[e.price], amount: Number(bigDecimal.add(acc[e.price].amount, e.amount)) } };
            }
          }, {} as { [key: string]: TransformedBidAskItem })),
        ),
        map(r => r.sort((a, b) => b.price - a.price)),
        map(r => r.slice(Math.max(0, r.length - this.maximumOrderBookRows), r.length)),
        untilDestroyed(this)
      ).subscribe(this.sortedAsks$);

    this.buySellPriceDiff$ =
      combineLatest([this.sortedBids$, this.sortedAsks$])
        .pipe(
          map(([bids, asks]) => {
            // Never allow negative.
            const amount = asks.length > 0 && bids.length > 0 ? +bigDecimal.subtract(asks[asks.length - 1].price, bids[0].price) : 0;
            if (amount < 0) {
              return 0;
            }

            return amount;
          })
        );

    this.priceOption$.pipe(skip(1), untilDestroyed(this)).subscribe((priceOption) => {
      if (this.data.token$.value) {
        setItem(StorageItem.SelectedTradePriceOption,
          { ...(getItem(StorageItem.SelectedTradePriceOption) || {}) as { [key: string]: PriceOptionType }, [this.data.token$.value.uid]: priceOption });
      }
    });

    merge(this.sortedBids$, this.sortedAsks$, this.currentTradeFormState$, this.amountControl.valueChanges)
      .pipe(
        filter(() => this.priceOption$.value === PriceOptionType.MARKET),
        untilDestroyed(this)
      )
      .subscribe(() => {
        let amount = Number(this.amountControl.value) * NETWORK_DETAIL[this.data.token$.value?.mintingData?.network || Network.IOTA].divideBy;
        let result = 0;
        if (this.currentTradeFormState$.value === TradeFormState.SELL) {
          for (let i = 0; i < this.sortedBids$.value.length; i++) {
            amount -= this.sortedBids$.value[i].amount;
            if (amount <= 0 || (i === this.sortedBids$.value.length - 1)) {
              result = this.sortedBids$.value[i].price;
              break;
            }
          }
        } else {
          for (let i = this.sortedAsks$.value.length - 1; i >= 0; i--) {
            amount -= this.sortedAsks$.value[i].amount;
            if (amount <= 0 || i === 0) {
              result = this.sortedAsks$.value[i].price;
              break;
            }
          }
        }
        this.priceControl.setValue(result);
        this.cd.markForCheck();
      });
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
  }

  private refreshDataSets(colorOptions: object): void {
    const range24h: dayjs.Dayjs[] = [];
    for (let i = 0; i <= 7; i++) {
      range24h.unshift(dayjs().subtract(4 * i, 'h').clone());
    }

    const range7d: dayjs.Dayjs[] = [];
    for (let i = 0; i <= 7; i++) {
      range7d.unshift(dayjs().subtract(i, 'd').clone());
    }

    const dataToShow: { data: number[]; labels: string[] } = {
      data: [],
      labels: []
    };

    if (this.lineChartData && this.chartLengthControl.value === ChartLengthType.DAY) {
      const sortedData = this.listenToPurchases24h$.value.sort((a, b) => a.createdOn!.seconds - b.createdOn!.seconds); // v.createdOn?.toDate()
      dataToShow.labels = range24h.map((v) => {
        return v.format('HH');
      });
      range24h.forEach((v, index) => {
        const purchases: TokenPurchase[] = sortedData.filter((b) => {
          return (dayjs(b.createdOn?.toDate()).isAfter(v) && (!range24h[index + 1] || dayjs(b.createdOn?.toDate()).isBefore(range24h[index + 1])));
        });

        const def = dataToShow.data[index - 1] || 0;
        dataToShow.data.push(purchases.length ? this.tokenPurchaseApi.calcVWAP(purchases) : def);
      });
    } else if (this.lineChartData && this.chartLengthControl.value === ChartLengthType.WEEK) {
      const sortedData = this.listenToPurchases7d$.value.sort((a, b) => a.createdOn!.seconds - b.createdOn!.seconds); // v.createdOn?.toDate()
      dataToShow.labels = range7d.map((v) => {
        return v.format('dd');
      });
      range7d.forEach((v, index) => {
        const purchases: TokenPurchase[] = sortedData.filter((b) => {
          return (dayjs(b.createdOn?.toDate()).isAfter(v) && (!range7d[index + 1] || dayjs(b.createdOn?.toDate()).isBefore(range7d[index + 1])));
        });

        const def = dataToShow.data[index - 1] || 0;
        dataToShow.data.push(purchases.length ? this.tokenPurchaseApi.calcVWAP(purchases) : def);
      });
    }

    // Remove the first element. This is because we are not able to default right amount for the first field.
    dataToShow.data.shift();
    dataToShow.labels.shift();
    this.lineChartData!.datasets = [
      {
        data: dataToShow.data,
        fill: 'origin',
        ...colorOptions
      }
    ];
    this.lineChartData!.labels = dataToShow.labels;
    this.lineChartData = <ChartConfiguration['data']>{ ...this.lineChartData };
    this.cd.markForCheck();
  }

  private listenToMemberSubs(member: Member | undefined): void {
    this.memberDistributionSub$?.unsubscribe();
    this.subscriptionsMembersBids$?.forEach((s) => {
      s.unsubscribe();
    });
    if (member?.uid && this.data.token$.value?.uid) {
      this.memberDistributionSub$ = this.tokenApi.getMembersDistribution(this.data.token$.value?.uid, member.uid).subscribe(this.memberDistribution$);
      // TODO paging?
      this.subscriptionsMembersBids$.push(this.tokenMarketApi.membersAsks(member.uid, this.data.token$.value?.uid, undefined, undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.myAsks$));
      this.subscriptionsMembersBids$.push(this.tokenMarketApi.membersBids(member.uid, this.data.token$.value?.uid, undefined, undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.myBids$));
    } else {
      this.memberDistribution$?.next(undefined);
    }
  }

  private listenToTrades(tokenId: string): void {
    // TODO Add pagging.
    this.subscriptions$.push(this.tokenMarketApi.asksActive(tokenId, undefined, undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.asks$));
    this.subscriptions$.push(this.tokenMarketApi.bidsActive(tokenId, undefined, undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.bids$));
  }

  private listenToStats(tokenId: string): void {
    // TODO Add pagging.
    this.subscriptions$.push(this.tokenPurchaseApi.listenToPurchases24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenToPurchases24h$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenToPurchases7d(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenToPurchases7d$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenAvgPrice24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenAvgPrice24h$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenAvgPrice7d(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenAvgPrice7d$));
    this.subscriptions$.push(this.tokenPurchaseApi.tokenTopHistory(tokenId).pipe(untilDestroyed(this)).subscribe(this.tradeHistory$));
    this.subscriptions$.push(this.tokenMarketApi.listenToAvgBuy(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenAvgBuy$));
    this.subscriptions$.push(this.tokenMarketApi.listenToAvgSell(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenAvgSell$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenChangePrice24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenChangePrice24h$));
  }

  public get chartLengthTypes(): typeof ChartLengthType {
    return ChartLengthType;
  }

  public get askListingTypes(): typeof AskListingType {
    return AskListingType;
  }

  public get bidAskStatuses(): typeof TokenTradeOrderStatus {
    return TokenTradeOrderStatus;
  }

  public get myTradingTypes(): typeof MyTradingType {
    return MyTradingType;
  }

  public get tradeFormStates(): typeof TradeFormState {
    return TradeFormState;
  }

  public get infinity(): typeof Infinity {
    return Infinity;
  }

  public get tokenTradeOrderTypes(): typeof TokenTradeOrderType {
    return TokenTradeOrderType;
  }

  public get mobileViewStates(): typeof MobileViewState {
    return MobileViewState;
  }

  private listenToToken(id: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.tokenApi.listen(id)
      .pipe(untilDestroyed(this))
      .subscribe(this.data.token$));
  }

  public getBidsTitle(_avg?: number): string {
    return $localize`Bids`;
  }

  public getAsksTitle(_avg?: number): string {
    return $localize`Asks`;
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public getShareUrl(token?: Token | null): string {
    return 'http://twitter.com/share?text=Check out token&url=' + (token?.wenUrlShort || token?.wenUrl || window?.location.href) + '&hashtags=soonaverse';
  }

  public async cancelOrder(tokenBuyBid: string): Promise<void> {
    const params: any = {
      uid: tokenBuyBid,
    };

    await this.auth.sign(params, (sc, finish) => {
      this.notification.processRequest(this.tokenMarketApi.cancel(sc), $localize`Cancelled.`, finish).subscribe(() => {
        //
      });
    });
  }

  public get bidListingTypes(): typeof BidListingType {
    return BidListingType;
  }

  public get priceOptionTypes(): typeof PriceOptionType {
    return PriceOptionType;
  }

  private groupOrders(r: TokenTradeOrder[]): TransformedBidAskItem[] {
    return Object.values(r.reduce((acc, e) => {
      const key = e.owner === this.auth.member$.value?.uid ? `${e.price}_${this.auth.member$.value?.uid || ''}` : e.price;
      return {
        ...acc,
        [key]: [...(acc[key] || []), e]
      };
    }, {} as { [key: number | string]: TokenTradeOrder[] }))
      .map(e => e.reduce((acc, el) => ({
        price: el.price,
        amount: acc.amount + el.count - el.fulfilled,
        isOwner: el.owner === this.auth.member$.value?.uid
      }), { price: 0, amount: 0, total: 0, isOwner: false } as TransformedBidAskItem));
  }

  public getResultAmount(): number {
    if (isNaN(this.amountControl.value) || isNaN(this.priceControl.value)) return 0;
    return Number(bigDecimal.multiply(this.amountControl.value, this.priceControl.value));
  }

  public openTradeModal(): void {
    if (this.currentTradeFormState$.value === TradeFormState.BUY) {
      this.isBidTokenOpen = true;
    } else {
      this.isAskTokenOpen = true;
    }
    this.cd.markForCheck();
  }

  public moreThanBalance(): boolean {
    return (this.currentTradeFormState$.value === TradeFormState.SELL) &&
            (this.memberDistribution$?.value?.tokenOwned !== null) &&
            ((this.memberDistribution$?.value?.tokenOwned || 0) / 1000 / 1000 < this.amountControl.value);
  }

  public get networkDetails(): typeof NETWORK_DETAIL {
    return NETWORK_DETAIL;
  }

  public setMidPrice(): void {
    combineLatest([this.sortedBids$, this.sortedAsks$])
      .pipe(
        filter(([bids, asks]) => bids.length > 0 && asks.length > 0),
        first(),
        untilDestroyed(this)
      ).subscribe(([bids, asks]) => {
        this.priceControl.setValue(bigDecimal.divide(bigDecimal.add(bids[0].price, asks[asks.length - 1].price), 2, 6));
      });
  }

  public isMidPrice(bids: TransformedBidAskItem[] | null, asks: TransformedBidAskItem[] | null): boolean {
    if (!bids?.length || !asks?.length) return false;
    return bigDecimal.divide(bigDecimal.add(bids[0].price, asks[asks.length - 1].price), 2, 6) === bigDecimal.round(this.priceControl.value, 6);
  }

  public setBidPrice(): void {
    this.sortedBids$
      .pipe(
        filter(bids => bids.length > 0),
        first(),
        untilDestroyed(this)
      ).subscribe(bids => {
        this.priceControl.setValue(bigDecimal.round(bids[0].price, 6))
      });
  }

  public isBidPrice(bids: TransformedBidAskItem[] | null): boolean {
    if (!bids?.length) return false;
    return bigDecimal.round(bids[0].price, 6) === bigDecimal.round(this.priceControl.value, 6);
  }

  public setAskPrice(): void {
    this.sortedAsks$
      .pipe(
        filter(asks => asks.length > 0),
        first(),
        untilDestroyed(this)
      ).subscribe(asks => {
        this.priceControl.setValue(bigDecimal.round(asks[asks.length - 1].price, 6))
      });
  }

  public isAskPrice(asks: TransformedBidAskItem[] | null): boolean {
    if (!asks?.length) return false;
    return bigDecimal.round(asks[asks.length - 1].price, 6) === bigDecimal.round(this.priceControl.value, 6);
  }

  public set24hVwapPrice(): void {
    this.priceControl.setValue(bigDecimal.round(this.listenAvgPrice24h$.getValue(), 6));
  }

  public is24hVwapPrice(): boolean {
    return this.listenAvgPrice24h$.getValue() !== 0 && bigDecimal.round(this.listenAvgPrice24h$.getValue(), 6) === bigDecimal.round(this.priceControl.value, 6);
  }

  public setFavourite(): void {
    this.isFavourite = !this.isFavourite;
    const favourites = (getItem(StorageItem.FavouriteTokens) as string[]) || [];
    setItem(StorageItem.FavouriteTokens, this.isFavourite ?
      [...favourites, this.data.token$.value?.uid] : favourites.filter(e => e !== this.data.token$.value?.uid));
    this.cd.markForCheck();
  }

  public getDateDiff(date: Timestamp): string {
    const dayDiff = dayjs().diff(dayjs(date.toDate()), 'day');
    if (dayDiff <= 0) {
      return '';
    }

    return dayjs(date.toDate()).fromNow();
  }

  public get exchangeFee(): number {
    return SERVICE_MODULE_FEE_TOKEN_EXCHANGE;
  }

  public getFee(): string {
    return this.unitsService.format(
      Number(bigDecimal.multiply(this.getResultAmount(), this.exchangeFee * 100 * 100)),
      this.data.token$.value?.mintingData?.network,
      true,
      true
    );
  }

  public orderBookRowClick(item: TransformedBidAskItem, state: TradeFormState): void {
    // Disabled setting of the amount as I believe it does not make sense.
    this.currentTradeFormState$.next(state === TradeFormState.BUY ? TradeFormState.SELL : TradeFormState.BUY);
    this.amountControl.setValue(item.amount / 1000 / 1000);
    this.priceOption$.next(PriceOptionType.LIMIT);
    this.priceControl.setValue(item.price);
  }

  public tradeHistoryClick(item: TokenPurchase): void {
    this.tradeDetailOrder = null;
    this.tradeDetailPurchases = item;
    this.cd.markForCheck();
  }

  public orderClick(item: TokenTradeOrder): void {
    this.subscriptions$.push(this.tokenPurchaseApi.tradeDetails(item.uid, item.type).pipe(first(), untilDestroyed(this)).subscribe(r => {
      this.tradeDetailOrder = item;
      this.tradeDetailPurchases = r;
      this.cd.markForCheck();
    }));
  }

  public getMinTotal(): number {
    return MIN_AMOUNT_TO_TRANSFER / 1000 / 1000;
  }

  public mobileBuySellClick(state: TradeFormState): void {
    this.currentTradeFormState$.next(state);
    this.isTradeDrawerVisible = true;
    this.cd.markForCheck();
  }

  public setCancelTradeOrder(event: MouseEvent, item: TokenTradeOrder): void {
    event.stopPropagation();
    this.cancelTradeOrder = item;
    this.cd.markForCheck();
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.cancelSubscriptions();
  }
}
