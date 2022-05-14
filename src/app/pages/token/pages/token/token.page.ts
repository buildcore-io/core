import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { SpaceApi } from '@api/space.api';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { WEN_NAME } from '@functions/interfaces/config';
import { Token, TokenStatus } from "@functions/interfaces/models/token";
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
import { first, skip, Subscription } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-token',
  templateUrl: './token.page.html',
  styleUrls: ['./token.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenPage implements OnInit, OnDestroy {
  public sections = [
    { route: [ROUTER_UTILS.config.token.overview], label: $localize`Overview` },
    { route: [ROUTER_UTILS.config.token.metrics], label: $localize`Metrics` },
    { route: [ROUTER_UTILS.config.token.airdrops], label: $localize`Airdrops` }
  ];
  public isTokenInfoVisible = false;
  private subscriptions$: Subscription[] = [];
  private memberDistributionSub$?: Subscription;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public data: DataService,
    private auth: AuthService,
    private titleService: Title,
    private tokenApi: TokenApi,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Token');
    this.route.params?.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string | undefined = obj?.[ROUTER_UTILS.config.token.token.replace(':', '')];
      if (id) {
        this.listenToToken(id);
      }
    });

    this.data.token$.pipe(skip(1), first()).subscribe((t) => {
      if (t) {
        this.subscriptions$.push(this.spaceApi.listen(t.space).pipe(untilDestroyed(this)).subscribe(this.data.space$));
      }
    });

    this.auth.member$?.pipe(untilDestroyed(this)).subscribe((member) => {
      this.memberDistributionSub$?.unsubscribe();
      if (member?.uid && this.data.token$.value?.uid) {
        this.memberDistributionSub$ = this.tokenApi.getMembersDistribution(this.data.token$.value?.uid, member.uid).subscribe(this.data.memberDistribution$);
      } else {
        this.data.memberDistribution$?.next(undefined);
      }
    });
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

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.cancelSubscriptions();
  }
}
