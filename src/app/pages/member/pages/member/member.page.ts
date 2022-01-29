import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import { BehaviorSubject, skip, Subscription } from 'rxjs';
import { WEN_NAME } from './../../../../../../functions/interfaces/config';
import { FILE_SIZES } from "./../../../../../../functions/interfaces/models/base";
import { Member } from './../../../../../../functions/interfaces/models/member';
import { FULL_LIST } from './../../../../@api/base.api';
import { MemberApi } from './../../../../@api/member.api';
import { NavigationService } from './../../../../@core/services/navigation/navigation.service';
import { DataService } from './../../services/data.service';

@UntilDestroy()
@Component({
  templateUrl: './member.page.html',
  styleUrls: ['./member.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberPage implements OnInit, OnDestroy {
  public memberId = ''
  public sections = [
    { route: 'activity', label: 'Activity' },
    { route: 'awards', label: 'Awards' },
    { route: 'badges', label: 'Badges' },
    { route: 'spaces', label: 'Spaces' }
  ]
  public isAboutMemberVisible = false;
  public height$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  @ViewChild('sidebar') private sidebar?: ElementRef;
  private subscriptions$: Subscription[] = [];
  constructor(
    private titleService: Title,
    private route: ActivatedRoute,
    private memberApi: MemberApi,
    private auth: AuthService,
    private router: Router,
    public nav: NavigationService,
    public data: DataService,
    public deviceService: DeviceService
  ) {
    // none.
  }

  ngOnInit() {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Member');
    this.route.params.subscribe((params) => {
      this.cancelSubscriptions();
      if (params?.memberId) {
        this.listenMember(params.memberId);
      } else {
        this.notFound();
      }
    });

    // If we're unable to find the space we take the user out as well.
    this.data.member$.pipe(skip(1), untilDestroyed(this)).subscribe((obj) => {
      if (!obj) {
        this.notFound();
      }
    });
  }

  @HostListener('window:scroll', ['$event'])
  public track() {
    this.height$.next(this.sidebar?.nativeElement.scrollHeight || 0);
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  public listenMember(memberId: string): void {
    this.subscriptions$.push(this.memberApi.topAwardsCompleted(memberId).pipe(untilDestroyed(this)).subscribe(this.data.awardsCompleted$));
    this.subscriptions$.push(this.memberApi.topAwardsPending(memberId).pipe(untilDestroyed(this)).subscribe(this.data.awardsPending$));
    // TODO Implement search. This is parked since we will be implementing new search here.
    this.subscriptions$.push(this.memberApi.topSpaces(memberId, undefined, undefined, FULL_LIST).pipe(untilDestroyed(this)).subscribe(this.data.space$));
    this.subscriptions$.push(this.memberApi.listen(memberId).pipe(untilDestroyed(this)).subscribe(this.data.member$));
  }

  public get loggedInMember$(): BehaviorSubject<Member|undefined> {
    return this.auth.member$;
  }

  public get urlToMembers(): string {
    return '/' + ROUTER_UTILS.config.discover.root + '/' + ROUTER_UTILS.config.discover.members;
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.cancelSubscriptions();
    this.data.resetSubjects();
  }
}
