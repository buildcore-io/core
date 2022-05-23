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
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { WEN_NAME } from '@functions/interfaces/config';
import { Member, Space } from '@functions/interfaces/models';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenDistribution, TokenPurchase, TokenStatus } from "@functions/interfaces/models/token";
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
import { ChartConfiguration, ChartType } from 'chart.js';
import * as dayjs from 'dayjs';
import { BehaviorSubject, first, skip, Subscription } from 'rxjs';

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
    { label: $localize`7d`, value: ChartLengthType.WEEK },
  ];
  public bids$: BehaviorSubject<TokenBuySellOrder[]> = new BehaviorSubject<TokenBuySellOrder[]>([]);
  public myBids$: BehaviorSubject<TokenBuySellOrder[]> = new BehaviorSubject<TokenBuySellOrder[]>([]);
  public asks$: BehaviorSubject<TokenBuySellOrder[]> = new BehaviorSubject<TokenBuySellOrder[]>([]);
  public myAsks$: BehaviorSubject<TokenBuySellOrder[]> = new BehaviorSubject<TokenBuySellOrder[]>([]);
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
  public chartLengthControl: FormControl = new FormControl(ChartLengthType.DAY, Validators.required);
  public memberDistribution$?: BehaviorSubject<TokenDistribution | undefined> = new BehaviorSubject<TokenDistribution | undefined>(undefined);
  public currentAskListing = AskListingType.OPEN;
  public currentBidsListing = BidListingType.OPEN;
  public lineChartType: ChartType = 'line';
  public lineChartData?: ChartConfiguration['data'] = {
    datasets: [],
    labels: []
  };
  public lineChartOptions?: ChartConfiguration['options'] = {
    elements: {
      line: {
        tension: 0
      }
    },
    scales: {
      xAxis: {
        ticks: {
          maxTicksLimit: 10,
          color: '#959388',
          font: {
            size: 14,
            weight: '600',
            family: 'Poppins',
            lineHeight: '14px'
          }
        }
      },
      yAxis: {
        beginAtZero: true,
        ticks: {
          color: '#959388',
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
        backgroundColor: '#333',
        titleColor: 'rgba(0,0,0,0)',
        titleSpacing: 0,
        titleMarginBottom: 0,
        titleFont: {
          lineHeight: 0
        },
        bodyColor: '#fff',
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
  public isBidTokenOpen = false;
  public isAskTokenOpen = false;
  private subscriptions$: Subscription[] = [];
  private subscriptionsMembersBids$: Subscription[] = [];
  private memberDistributionSub$?: Subscription;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public data: DataService,
    private auth: AuthService,
    private titleService: Title,
    private tokenApi: TokenApi,
    private cd: ChangeDetectorRef,
    private tokenPurchaseApi: TokenPurchaseApi,
    private notification: NotificationService,
    private tokenMarketApi: TokenMarketApi,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute
  ) {}

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
      }
    });

    this.auth.member$?.pipe(untilDestroyed(this)).subscribe((member) => {
      this.listenToMemberSubs(member);
    });

    // TODO This should be done differently.
    setTimeout(() => {
      this.chartLengthControl.valueChanges.pipe(untilDestroyed(this)).subscribe(() => {
        this.refreshDataSets();
      });

      this.listenToPurchases24h$.pipe(untilDestroyed(this)).subscribe(() => {
        this.refreshDataSets();
      });

      this.listenToPurchases7d$.pipe(untilDestroyed(this)).subscribe(() => {
        this.refreshDataSets();
      });

      this.refreshDataSets();
    }, 750);
  }

  private refreshDataSets(): void {
    const range24h: string[] = [];
    for (let i=0; i <= 7 ; i++) {
      range24h.unshift((dayjs().subtract(4 * i, 'h')).format('HH'));
    }

    const range7d: string[] = [];
    for (let i=0; i <= 7 ; i++) {
      range7d.unshift((dayjs().subtract(i, 'd')).format('dd'));
    }

    const dataToShow: { data: number[]; labels: string[]} = {
      data: [],
      labels: []
    };

    if (this.lineChartData && this.chartLengthControl.value === ChartLengthType.DAY) {
      const sortedData = this.listenToPurchases24h$.value.sort((a, b) => a.createdOn!.seconds - b.createdOn!.seconds); // v.createdOn?.toDate()
      dataToShow.labels = range24h;
      range24h.forEach((v, index) => {
        const prev = range24h[index - 1];
        if (!prev) {
          dataToShow.data.push(this.listenAvgPrice24h$.value || 0);
        } else {
          const purchases: TokenPurchase[] = sortedData.filter((b) => {
            return (dayjs(b.createdOn?.toDate()).hour() > Number(prev) && dayjs(b.createdOn?.toDate()).hour() < Number(v));
          });

          dataToShow.data.push(purchases.length ? this.tokenPurchaseApi.calcVWAP(purchases) : (this.listenAvgPrice24h$.value || 0));
        }
      });
    } else if (this.lineChartData && this.chartLengthControl.value === ChartLengthType.WEEK) {
      const sortedData = this.listenToPurchases7d$.value.sort((a, b) => a.createdOn!.seconds - b.createdOn!.seconds); // v.createdOn?.toDate()
      dataToShow.labels = range7d;
      range7d.forEach((v, index) => {
        const prev = range7d[index - 1];
        if (!prev) {
          dataToShow.data.push(this.listenAvgPrice7d$.value || 0);
        } else {
          const purchases: TokenPurchase[] = sortedData.filter((b) => {
            return (dayjs(b.createdOn?.toDate()).hour() > Number(prev) && dayjs(b.createdOn?.toDate()).hour() < Number(v));
          });

          dataToShow.data.push(purchases.length ? this.tokenPurchaseApi.calcVWAP(purchases) : (this.listenAvgPrice7d$.value || 0));
        }
      });
    }

    this.lineChartData!.datasets = [
      {
        data: dataToShow.data,
        fill: 'origin',
        backgroundColor: '#FCFBF9',
        borderColor: '#F39200',
        pointBackgroundColor: '#F39200',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#333',
        pointHoverBorderColor: '#fff'
      }
    ];
    this.lineChartData!.labels = dataToShow.labels;
    this.lineChartData = <ChartConfiguration['data']>{...this.lineChartData};
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
    this.subscriptions$.push(this.tokenMarketApi.listenToAvgBuy(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenAvgBuy$));
    this.subscriptions$.push(this.tokenMarketApi.listenToAvgSell(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenAvgSell$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenChangePrice24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenChangePrice24h$));
  }

  public formatBest(amount: number | undefined | null, mega = false): string {
    if (!amount) {
      return '0 Mi';
    }

    return UnitsHelper.formatBest(Math.floor(Number(amount) * (mega ? (1000 * 1000) : 1)), 2);
  }

  public formatTokenBest(amount?: number | null): string {
    if (!amount) {
      return '0';
    }

    return (amount / 1000 / 1000).toFixed(6);
  }

  public get chartLengthTypes(): typeof ChartLengthType {
    return ChartLengthType;
  }

  public get askListingTypes(): typeof AskListingType {
    return AskListingType;
  }

  public get bidAskStatuses(): typeof TokenBuySellOrderStatus {
    return TokenBuySellOrderStatus;
  }

  public preMinted(token?: Token): boolean {
    return token?.status === TokenStatus.PRE_MINTED;
  }

  private listenToToken(id: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.tokenApi.listen(id)
      .pipe(untilDestroyed(this))
      .subscribe(this.data.token$));
  }

  public getBidsTitle(_avg?: number): string {
    return $localize`Bids`; // + ' ' + ((avg && avg > 0) ? '(' + $localize`avg price ` + this.formatBest(avg * 1000 * 1000) + ')' : '');
  }

  public getAsksTitle(_avg?: number): string {
    return $localize`Asks`; // + ' ' + ((avg && avg > 0) ? '(' + $localize`avg price ` + this.formatBest(avg * 1000 * 1000) + ')' : '');
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public getShareUrl(token?: Token | null): string {
    return token?.wenUrlShort || token?.wenUrl || window.location.href;
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.cancelSubscriptions();
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
}
