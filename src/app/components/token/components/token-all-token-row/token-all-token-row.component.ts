import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TokenPurchaseApi } from '@api/token_purchase.api';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { UnitsService } from '@core/services/units';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Token, TokenStatus } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HelperService } from '@pages/token/services/helper.service';
import { BehaviorSubject, Subscription } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-token-all-token-row',
  templateUrl: './token-all-token-row.component.html',
  styleUrls: ['./token-all-token-row.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenAllTokenRowComponent implements OnInit, OnDestroy {
  @Input() token?: Token;
  public path = ROUTER_UTILS.config.token.root;
  public tradePath = ROUTER_UTILS.config.token.trade;
  public listenAvgPrice24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
  public listenVolume24h$: BehaviorSubject<number | undefined> = new BehaviorSubject<number | undefined>(undefined);
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
    this.subscriptions$.push(this.tokenPurchaseApi.listenVolume24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenVolume24h$));
    this.subscriptions$.push(this.tokenPurchaseApi.listenChangePrice24h(tokenId).pipe(untilDestroyed(this)).subscribe(this.listenChangePrice24h$));
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

  public tradable(): boolean {
    return this.token?.status === TokenStatus.PRE_MINTED || this.token?.status === TokenStatus.MINTED || this.token?.status === TokenStatus.BASE;
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
