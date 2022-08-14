import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TokenPurchaseApi } from '@api/token_purchase.api';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Token, TokenStatus } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HelperService } from '@pages/token/services/helper.service';
import dayjs from 'dayjs';
import { BehaviorSubject, Subscription } from 'rxjs';
import { TokenCardType } from '../token-card/token-card.component';

@UntilDestroy()
@Component({
  selector: 'wen-token-launchpad-row',
  templateUrl: './token-launchpad-row.component.html',
  styleUrls: ['./token-launchpad-row.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenLaunchpadRowComponent implements OnInit, OnDestroy {
  @Input() token?: Token;
  public path = ROUTER_UTILS.config.token.root;
  public listenAvgPrice24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenAvgPrice7d$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenVolume24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenVolume7d$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenChangePrice24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  private subscriptions$: Subscription[] = [];

  constructor(
    public previewImageService: PreviewImageService,
    public helper: HelperService,
    public deviceService: DeviceService,
    public unitsService: UnitsService,
    private tokenPurchaseApi: TokenPurchaseApi
  ) { }

  public ngOnInit(): void {
    if (this.token?.uid) {
      this.listenToStats(this.token.uid);
    }
  }

  private listenToStats(tokenId: string): void {
    // TODO Add pagging.
    this.subscriptions$.push(this.tokenPurchaseApi.listenAvgPrice24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenAvgPrice24h$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenAvgPrice7d(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenAvgPrice7d$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenVolume24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenVolume24h$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenVolume7d(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenVolume7d$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenChangePrice24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenChangePrice24h$));
  }

  public available(): boolean {
    return dayjs(this.token?.saleStartDate?.toDate()).isBefore(dayjs()) && this.token?.status === TokenStatus.AVAILABLE;
  }

  public saleNotStarted(): boolean {
    return dayjs(this.token?.saleStartDate?.toDate()).isAfter(dayjs());
  }

  public getEndDate(): dayjs.Dayjs {
    return dayjs(this.token?.saleStartDate?.toDate()).add(this.token?.saleLength || 0, 'ms');
  }

  public saleEnded(): boolean {
    return this.getEndDate().isBefore(dayjs());
  }

  public isInCoolDown(): boolean {
    return dayjs(this.token?.coolDownEnd?.toDate()).isAfter(dayjs()) && this.saleEnded();
  }

  public getPrc(): number {
    const prc = ((this.token?.totalDeposit || 0) / (this.token?.pricePerToken || 0) / this.getPublicSaleSupply());
    return (prc > 1 ? 1 : prc) * 100;
  }

  public getPublicSaleSupply(): number {
    let sup = 0;
    this.token?.allocations.forEach((b) => {
      if (b.isPublicSale) {
        sup = b.percentage / 100;
      }
    });

    return (this.token?.totalSupply || 0) * sup;
  }
  
  public getCardType(): TokenCardType | undefined {
    const endDate = this.getEndDate();
    // 1 / 5 is close to ending.
    let cardType;
    if (endDate.isBefore(dayjs()) && dayjs(this.token?.coolDownEnd?.toDate()).isAfter(dayjs())) {
      cardType = TokenCardType.ENDING;
    } else if (dayjs(this.token?.saleStartDate?.toDate()).isBefore(dayjs()) && endDate.isAfter(dayjs())) {
      cardType = TokenCardType.ONGOING;
    }
    return cardType;
  }

  public get tokenCardTypes(): typeof TokenCardType {
    return TokenCardType;
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
