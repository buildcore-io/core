import { Location } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Award } from 'functions/interfaces/models';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, skip, Subscription } from 'rxjs';
import { WenRequest } from './../../../../../../functions/interfaces/models/base';
import { AwardApi } from './../../../../@api/award.api';
import { SpaceApi } from './../../../../@api/space.api';
import { AuthService } from './../../../../components/auth/services/auth.service';
import { DataService } from './../../services/data.service';
// TODO is completed validation on endDate.
// import dayjs from 'dayjs'

@UntilDestroy()
@Component({
  selector: 'wen-award',
  templateUrl: './award.page.html',
  styleUrls: ['./award.page.less']
})
export class AwardPage implements OnInit, OnDestroy {
  public sections = [
    { route: [ROUTER_UTILS.config.award.overview], label: 'Overview' },
    { route: [ROUTER_UTILS.config.award.participants], label: 'Participants' }
  ];
  public isSubmitParticipationModalVisible = false;
  private subscriptions$: Subscription[] = [];
  private guardiansSubscription$?: Subscription;

  constructor(
    private auth: AuthService,
    private location: Location,
    private router: Router,
    private notification: NzNotificationService,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute,
    private awardApi: AwardApi,
    private cd: ChangeDetectorRef,
    public data: DataService
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.route.params.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.proposal.proposal.replace(':', '')];
      if (id) {
        this.listenToAward(id);
      } else {
        this.notFound();
      }
    });

    // If we're unable to find the space we take the user out as well.
    this.data.award$.pipe(skip(1)).subscribe((obj: Award|undefined) => {
      if (!obj) {
        this.notFound();
        return;
      }

      // Once we load proposal let's load guardians for the space.
      if (this.guardiansSubscription$) {
        this.guardiansSubscription$.unsubscribe();
      }
      if (this.auth.member$.value?.uid) {
        this.guardiansSubscription$ = this.spaceApi.isGuardianWithinSpace(obj.space, this.auth.member$.value.uid)
                                      .pipe(untilDestroyed(this)).subscribe(this.data.isGuardianWithinSpace$);
      }
    });

    this.data.participants$.pipe(untilDestroyed(this)).subscribe(() => {
      this.cd.markForCheck();
    });
  }

  public goBack(): void {
    this.location.back();
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  private listenToAward(id: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.awardApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.data.award$));
    this.subscriptions$.push(this.awardApi.listenOwners(id).pipe(untilDestroyed(this)).subscribe(this.data.owners$));
    this.subscriptions$.push(this.awardApi.listenParticipants(id).pipe(untilDestroyed(this)).subscribe(this.data.participants$));
  }

  public showParticipateModal(): void {
    this.isSubmitParticipationModalVisible = true;
  }

  public handleParticipateCancel(): void {
    this.isSubmitParticipationModalVisible = false;
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public getExperiencePointsPerBadge(award: Award|undefined|null): number {
    if (award?.badge?.xp && award.badge.xp > 0 && award?.badge?.count > 1) {
      return (award.badge.xp || 0) / (award.badge.count || 0);
    } else {
      return award?.badge?.xp || 0;
    }
  }

  public loggedInMemberIsParticipant(): boolean {
    if (!this.data.participants$.value) {
      return false;
    }

    if (!this.auth.member$.value?.uid) {
      return false;
    }

    return this.data.participants$.value.filter(e => e.uid === this.auth.member$.value?.uid).length > 0;
  }

  public async participate(): Promise<void> {
    this.isSubmitParticipationModalVisible = false;
    if (!this.data.award$.value?.uid) {
      return;
    }

    // TODO Add support for comments.
    const sc: WenRequest|undefined =  await this.auth.signWithMetamask(
      undefinedToEmpty({
        uid: this.data.award$.value.uid
      })
    );

    if (!sc) {
      throw new Error('Unable to sign.');
    }

    // TODO Handle this via queue and clean-up.
    this.awardApi.participate(sc).subscribe(() => {
      this.notification.success('Participated.', '');
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
    if (this.guardiansSubscription$) {
      this.guardiansSubscription$.unsubscribe();
    }
  }
}
