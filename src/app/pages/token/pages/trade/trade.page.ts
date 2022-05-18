import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
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
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenDistribution, TokenStatus } from "@functions/interfaces/models/token";
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
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
  public listenAvgPrice24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenAvgPrice7d$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenVolume24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenVolume7d$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenChangePrice24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public chartLengthControl: FormControl = new FormControl(ChartLengthType.WEEK, Validators.required);
  public memberDistribution$?: BehaviorSubject<TokenDistribution | undefined> = new BehaviorSubject<TokenDistribution | undefined>(undefined);
  public currentAskListing = AskListingType.OPEN;
  public currentBidsListing = BidListingType.OPEN;
  private subscriptions$: Subscription[] = [];
  private subscriptionsMembersBids$: Subscription[] = [];
  public isBidTokenOpen = false;
  public isAskTokenOpen = false;
  private memberDistributionSub$?: Subscription;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public data: DataService,
    private auth: AuthService,
    private titleService: Title,
    private tokenApi: TokenApi,
    private tokenPurchaseApi: TokenPurchaseApi,
    private notification: NotificationService,
    private tokenMarketApi: TokenMarketApi,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute
  ) { }

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
    this.subscriptions$.push(this.tokenPurchaseApi.listenAvgPrice24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenAvgPrice24h$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenAvgPrice7d(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenAvgPrice7d$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenVolume24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenVolume24h$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenVolume7d(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenVolume7d$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenChangePrice24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenChangePrice24h$));
  }

  public formatBest(amount: number | undefined | null, mega = false): string {
    if (!amount) {
      return '0 Mi';
    }

    return UnitsHelper.formatBest(Number(amount) * (mega ? (1000 * 1000) : 1), 2);
  }

  public formatTokenBest(amount?: number | null): string {
    if (!amount) {
      return '0';
    }

    return (amount / 1000 / 1000).toFixed(2);
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

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public getLatestStatus(token?: Token): string {
    if (token?.status === TokenStatus.AVAILABLE) {
      return $localize`Available`;
    } else if (token?.status === TokenStatus.PROCESSING) {
      return $localize`Processing`;
    } else {
      return $localize`Pre-Minted`;
    }
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
