import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Award } from 'functions/interfaces/models';
import { BehaviorSubject, Subscription } from 'rxjs';
import { AwardApi } from './../../../../@api/award.api';
import { SpaceApi } from './../../../../@api/space.api';

@UntilDestroy()
@Component({
  selector: 'wen-awards',
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AwardsPage implements OnInit, OnDestroy {
  public spaceId?: string;
  public awards$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public isMemberWithinSpace$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private subscriptions$: Subscription[] = [];

  constructor(
    private router: Router,
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private awardApi: AwardApi,
    private cd: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    this.route.parent?.params.subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.space.space.replace(':', '')];
      if (id) {
        this.cancelSubscriptions();
        this.listenToIsMemberAndGuardian(id);
        this.spaceId = id;
      } else {
        this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
      }
    });
  }

  private listenToIsMemberAndGuardian(spaceId: string): void {
    if (this.auth.member$.value) {
      this.subscriptions$.push(
        this.awardApi.listenForSpace(spaceId).pipe(untilDestroyed(this)).subscribe(this.awards$)
      );
      this.subscriptions$.push(
        this.spaceApi.isMemberWithinSpace(spaceId, this.auth.member$.value.uid).pipe(untilDestroyed(this)).subscribe(this.isMemberWithinSpace$)
      );
    }
  }

  public create(): void {
    this.router.navigate([
      ('/' + ROUTER_UTILS.config.award.root),
      ROUTER_UTILS.config.award.newAward,
      { space: this.spaceId }
    ]);
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
