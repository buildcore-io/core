import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import { BehaviorSubject, skip, Subscription } from 'rxjs';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { MemberApi } from './../../../../@api/member.api';
import { DataService } from './../../services/data.service';

@UntilDestroy()
@Component({
  templateUrl: './member.page.html',
  styleUrls: ['./member.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberPage implements OnInit, OnDestroy {
  memberId = ''
  sections = [
    { route: 'activity', label: 'Activity' },
    { route: 'awards', label: 'Awards' },
    { route: 'badges', label: 'Badges' },
    { route: 'yield', label: 'Yield' }
  ]
  public drawerVisible$ = new BehaviorSubject<boolean>(false);
  private subscriptions$: Subscription[] = [];
  constructor(
    private route: ActivatedRoute,
    private memberApi: MemberApi,
    private auth: AuthService,
    private router: Router,
    public data: DataService
  ) {
    // none.
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.cancelSubscriptions();
      if (params?.memberId) {
        this.listenMember(params.memberId);
      } else {
        this.notFound();
      }
    });

    // If we're unable to find the space we take the user out as well.
    this.data.member$.pipe(skip(1)).subscribe((obj) => {
      if (!obj) {
        this.notFound();
      }
    });
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  public listenMember(memberId: string): void {
    this.subscriptions$.push(this.memberApi.topAwards(memberId).pipe(untilDestroyed(this)).subscribe(this.data.awards$));
    this.subscriptions$.push(this.memberApi.topBadges(memberId).pipe(untilDestroyed(this)).subscribe(this.data.badges$));
    this.subscriptions$.push(this.memberApi.listen(memberId).pipe(untilDestroyed(this)).subscribe(this.data.member$));
  }

  public get loggedInMember$(): BehaviorSubject<Member|undefined> {
    return this.auth.member$;
  }

  public get urlToMembers(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.members;
  }

  public openDrawer(): void {
    this.drawerVisible$.next(true);
  }

  public closeDrawer(): void {
    this.drawerVisible$.next(false);
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
