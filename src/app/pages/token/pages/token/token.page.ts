import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FileApi } from '@api/file.api';
import { SpaceApi } from '@api/space.api';
import { TokenApi } from '@api/token.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { SeoService } from '@core/services/seo';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Member } from '@functions/interfaces/models';
import { Token, TokenStatus } from "@functions/interfaces/models/token";
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DataService } from '@pages/token/services/data.service';
import { HelperService } from '@pages/token/services/helper.service';
import { BehaviorSubject, first, interval, skip, Subscription, take } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-token',
  templateUrl: './token.page.html',
  styleUrls: ['./token.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenPage implements OnInit, OnDestroy {
  public overviewSection = { route: [ROUTER_UTILS.config.token.overview], label: $localize`Overview` };
  public metricsSection = { route: [ROUTER_UTILS.config.token.metrics], label: $localize`Metrics` };
  public guardianOnlySection = { route: [ROUTER_UTILS.config.token.airdrops], label: $localize`Airdrops` };
  public sections = [
    this.overviewSection,
    this.metricsSection
  ];
  public isTokenInfoVisible = false;
  public isGuardianWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private subscriptions$: Subscription[] = [];
  private memberDistributionSub$?: Subscription;
  private guardiansSubscription$?: Subscription;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public data: DataService,
    public helper: HelperService,
    private auth: AuthService,
    private cd: ChangeDetectorRef,
    private tokenApi: TokenApi,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute,
    private seo: SeoService,
    private fileApi: FileApi
  ) {}

  // !helper.isMinted(token) ?
  public ngOnInit(): void {
    this.route.params?.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string | undefined = obj?.[ROUTER_UTILS.config.token.token.replace(':', '')];
      if (id) {
        this.listenToToken(id);
      }
    });

    this.data.token$.pipe(skip(1), first()).subscribe((t) => {
      if (t) {
        this.fileApi.getMetadata(t?.overviewGraphics || '')
          .pipe(take(1), untilDestroyed(this))
          .subscribe(o => {
            this.seo.setTags(
              $localize`Token` + ' - ' + this.helper.getPair(t),
              $localize`Buy, sell, and trade SOON and Shimmer tokens on a non-custodial, secure L1 exchange. Get started in minutes. Join today.`,
              o.contentType?.match('image/.*') ? t.overviewGraphics : undefined
            );
          });
        this.subscriptions$.push(this.spaceApi.listen(t.space).pipe(untilDestroyed(this)).subscribe(this.data.space$));
        this.subscriptions$.push(this.tokenApi.getDistributions(t.uid).pipe(untilDestroyed(this)).subscribe(this.data.distributions$));
        this.listenToMemberSubs(this.auth.member$.value);

        if (this.helper.isMinted(t)) {
          this.sections = [this.overviewSection, this.guardianOnlySection];
        }
      }
    });

    this.auth.member$?.pipe(untilDestroyed(this)).subscribe((member) => {
      this.listenToMemberSubs(member);
    });

    this.isGuardianWithinSpace$.pipe(untilDestroyed(this)).subscribe((t) => {
      if (t && this.sections.length === 2 && !this.helper.isMinted(this.data.token$.value)) {
        this.sections.push(this.guardianOnlySection);
      } else if (this.sections.length === 3) {
        this.sections.splice(3, 1);
      }

      this.sections = [...this.sections];
      this.cd.markForCheck();
    });

    // Ticket to refresh view after sale starts.
    let activated = false;
    const intervalSubs = interval(1000).pipe(untilDestroyed(this)).subscribe(() => {
      if (!activated && this.helper.isAfterSaleStarted()) {
        this.data.token$.next(this.data.token$.value);
        activated = true;
        intervalSubs.unsubscribe();
      }
    });
  }

  private listenToMemberSubs(member: Member | undefined): void {
    this.memberDistributionSub$?.unsubscribe();
    this.guardiansSubscription$?.unsubscribe();
    if (member?.uid && this.data.token$.value?.uid) {
      this.memberDistributionSub$ = this.tokenApi.getMembersDistribution(this.data.token$.value?.uid, member.uid).subscribe(this.data.memberDistribution$);
      this.guardiansSubscription$ = this.spaceApi.isGuardianWithinSpace(this.data.token$.value?.space, member?.uid).pipe(untilDestroyed(this)).subscribe(this.isGuardianWithinSpace$);
    } else {
      this.data.memberDistribution$?.next(undefined);
    }
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
    if (this.helper.isSalesInProgress(token) && !this.helper.isInCooldown(token)) {
      return $localize`Ongoing Sale`;
    } else if (this.helper.isScheduledForSale(token) && !this.helper.isInCooldown(token)) {
      return $localize`Scheduled`;
    } else if (this.helper.isInCooldown(token)) {
      return $localize`Cooldown`;
    } else if (token?.status === TokenStatus.PROCESSING) {
      return $localize`Processing`;
    } else {
      return $localize`Available`;
    }
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
