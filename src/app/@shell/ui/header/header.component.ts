import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';
import { MemberApi } from './../../../@api/member.api';

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
  constructor(
    private router: Router,
    private memberApi: MemberApi,
    private cd: ChangeDetectorRef,
    public auth: AuthService
  ) {}

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
      } else {
        this.enableCreateAwardProposal = false;
        this.cd.markForCheck();
      }
    });

    this.router.events.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj instanceof NavigationStart) {
        const previous = this.isMemberProfile;
        if (obj.url && obj.url.startsWith(('/' + ROUTER_UTILS.config.member.root + '/'))) {
          this.isMemberProfile = true;
        } else {
          this.isMemberProfile = false;
        }

        if (previous !== this.isMemberProfile) {
          this.cd.markForCheck();
        }
      }
    });
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public get member$(): BehaviorSubject<Member|undefined> {
    return this.auth.member$;
  }

  public get urlToNewSpace(): string {
    return '/' + ROUTER_UTILS.config.space.root + '/new';
  }

  public get urlToNewProposal(): string {
    return '/' + ROUTER_UTILS.config.proposal.root + '/new';
  }

  public get urlToNewAward(): string {
    return '/' + ROUTER_UTILS.config.award.root + '/new';
  }

  public goToMyProfile(): void {
    if (this.member$.value?.uid) {
      this.router.navigate([ROUTER_UTILS.config.member.root, this.member$.value.uid]);
    }
  }

  public ngOnDestroy(): void {
    this.spaceSubscription$?.unsubscribe();
  }
}
