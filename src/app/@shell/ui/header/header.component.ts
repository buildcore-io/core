import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { RouterService } from '@core/services/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, debounceTime, fromEvent, Subscription } from 'rxjs';
import { FILE_SIZES } from "./../../../../../functions/interfaces/models/base";
import { Member } from './../../../../../functions/interfaces/models/member';
import { MemberApi } from './../../../@api/member.api';

const IS_SCROLLED_HEIGHT = 20;

@UntilDestroy()
@Component({
  selector: 'wen-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent implements OnInit {
  public path = ROUTER_UTILS.config.base;
  public enableCreateAwardProposal = false;
  public spaceSubscription$?: Subscription;
  public isMemberProfile = false;
  public isLandingPage = false;
  public isAllowedCreation = false;
  public isMobileMenuVisible = false;
  public isScrolled = false;
  constructor(
    private router: Router,
    private memberApi: MemberApi,
    private cd: ChangeDetectorRef,
    public auth: AuthService,
    public deviceService: DeviceService,
    public routerService: RouterService
  ) { }

  public ngOnInit(): void {
    this.member$.pipe(
      untilDestroyed(this)
    ).subscribe(async (obj) => {
      if (obj?.uid) {
        this.spaceSubscription$?.unsubscribe();
        this.spaceSubscription$ = this.memberApi.topSpaces(obj.uid, 'createdOn', undefined, 1).subscribe((space) => {
          this.enableCreateAwardProposal = space.length > 0;
          this.cd.markForCheck();
        });

        // TEMPORARY -> member must have at least one badge.
        this.spaceSubscription$ = this.memberApi.topBadges(obj.uid, 'createdOn', undefined, 1).subscribe((badge) => {
          this.isAllowedCreation = badge.length > 0;
          this.cd.markForCheck();
        });
      } else {
        this.enableCreateAwardProposal = false;
        this.cd.markForCheck();
      }
    });

    const memberRoute = `/${ROUTER_UTILS.config.member.root}/`
    const landingPageRoute = `/${ROUTER_UTILS.config.base.home}`

    this.router.events.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj instanceof NavigationStart) {
        const previousIsMemberProfile = this.isMemberProfile;
        const previousIsLandingPage = this.isLandingPage;

        this.isMemberProfile = Boolean(obj.url?.startsWith(memberRoute))
        this.isLandingPage = Boolean(obj.url === landingPageRoute)

        if (previousIsMemberProfile !== this.isMemberProfile || previousIsLandingPage || this.isLandingPage) {
          this.cd.markForCheck();
        }
      }
    });

    fromEvent(window, 'scroll')
      .pipe(
        debounceTime(50),
        untilDestroyed(this)
      )
      .subscribe(this.onScroll.bind(this));
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public get member$(): BehaviorSubject<Member | undefined> {
    return this.auth.member$;
  }

  public get urlToDiscover(): string {
    return '/' + ROUTER_UTILS.config.discover.root;
  }

  public goToMyProfile(): void {
    if (this.member$.value?.uid) {
      this.router.navigate([ROUTER_UTILS.config.member.root, this.member$.value.uid]);
    }
  }

  private onScroll(): void {
    this.isScrolled = window.scrollY > IS_SCROLLED_HEIGHT;
    this.cd.markForCheck();
  }

  public ngOnDestroy(): void {
    this.spaceSubscription$?.unsubscribe();
  }
}
