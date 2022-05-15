import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { FULL_LIST } from '@api/base.api';
import { SpaceApi } from '@api/space.api';
import { TokenApi } from '@api/token.api';
import { TokenMarketApi } from '@api/token_market.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { NotificationService } from '@core/services/notification';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { WEN_NAME } from '@functions/interfaces/config';
import { Member, Space } from '@functions/interfaces/models';
import { Token, TokenBuySellOrder, TokenDistribution, TokenStatus } from "@functions/interfaces/models/token";
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
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
  public token$: BehaviorSubject<Token | undefined> = new BehaviorSubject<Token | undefined>(undefined);
  public space$: BehaviorSubject<Space | undefined> = new BehaviorSubject<Space | undefined>(undefined);
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
    private auth: AuthService,
    private titleService: Title,
    private tokenApi: TokenApi,
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
      }
    });

    this.token$.pipe(skip(1), first()).subscribe((t) => {
      if (t) {
        this.subscriptions$.push(this.spaceApi.listen(t.space).pipe(untilDestroyed(this)).subscribe(this.space$));
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
    if (member?.uid && this.token$.value?.uid) {
      this.memberDistributionSub$ = this.tokenApi.getMembersDistribution(this.token$.value?.uid, member.uid).subscribe(this.memberDistribution$);
      // TODO paging?
      this.subscriptionsMembersBids$.push(this.tokenMarketApi.membersAsks(member.uid, this.token$.value?.uid, undefined, undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.myAsks$));
      this.subscriptionsMembersBids$.push(this.tokenMarketApi.membersBids(member.uid, this.token$.value?.uid, undefined, undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.myBids$));
    } else {
      this.memberDistribution$?.next(undefined);
    }
  }

  private listenToTrades(tokenId: string): void {
    // TODO Add pagging.
    this.subscriptions$.push(this.tokenMarketApi.asks(tokenId, undefined, undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.asks$));
    this.subscriptions$.push(this.tokenMarketApi.bids(tokenId, undefined, undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.bids$));
  }

  public formatBest(amount: number | undefined | null, symbol = 'IOTA'): string {
    if (!amount) {
      return '0 ' + symbol;
    }

    return UnitsHelper.formatBest(amount, 2, symbol);
  }

  public get chartLengthTypes(): typeof ChartLengthType {
    return ChartLengthType;
  }

  public get askListingTypes(): typeof AskListingType {
    return AskListingType;
  }

  public preMinted(token?: Token): boolean {
    return token?.status === TokenStatus.PRE_MINTED;
  }

  private listenToToken(id: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.tokenApi.listen(id)
      .pipe(untilDestroyed(this))
      .subscribe(this.token$));
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
