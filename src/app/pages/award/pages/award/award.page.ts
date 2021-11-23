import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Award } from 'functions/interfaces/models';
import { BehaviorSubject, first, skip, Subscription } from 'rxjs';
import { AwardApi } from './../../../../@api/award.api';
import { FileApi, FILE_SIZES } from './../../../../@api/file.api';
import { SpaceApi } from './../../../../@api/space.api';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { AuthService } from './../../../../components/auth/services/auth.service';
import { DataService } from './../../services/data.service';

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
  public commentControl: FormControl = new FormControl('');
  private subscriptions$: Subscription[] = [];
  private guardiansSubscription$?: Subscription;

  constructor(
    private auth: AuthService,
    private router: Router,
    private notification: NotificationService,
    private spaceApi: SpaceApi,
    private route: ActivatedRoute,
    private awardApi: AwardApi,
    private cd: ChangeDetectorRef,
    public data: DataService,
    public nav: NavigationService
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.route.params.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.award.award.replace(':', '')];
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

    this.data.award$.pipe(skip(1), first()).subscribe((a) => {
      if (a) {
        this.subscriptions$.push(this.spaceApi.listen(a.space).pipe(untilDestroyed(this)).subscribe(this.data.space$));
      }
    });
  }

  public getAvatarSize(url?: string|null): string|undefined {
    if (!url) {
      return undefined;
    }

    return FileApi.getUrl(url, 'space_avatar', FILE_SIZES.small);
  }


  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
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

    await this.auth.sign({
      uid: this.data.award$.value.uid,
      comment: this.commentControl.value || undefined
    }, (sc, finish) => {
      this.notification.processRequest(this.awardApi.participate(sc), 'Participated.', finish).subscribe(() => {
        // none
      });
    });

  }

  // public async cancel(): Promise<void> {
  //   alert('SOON you can!');
  // }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
    if (this.guardiansSubscription$) {
      this.guardiansSubscription$.unsubscribe();
    }
  }
}
