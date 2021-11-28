import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ThemeList, ThemeService } from '@core/services/theme';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Award, Space } from 'functions/interfaces/models';
import { BehaviorSubject } from 'rxjs';
import { AwardApi } from './../../@api/award.api';
import { SpaceApi } from './../../@api/space.api';

@UntilDestroy()
@Component({
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage implements OnInit {
  public path = ROUTER_UTILS.config;
  public theme = ThemeList;
  public award$: BehaviorSubject<Award[]> = new BehaviorSubject<Award[]>([]);
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);

  constructor(
    private auth: AuthService,
    private themeService: ThemeService,
    private router: Router,
    private awardApi: AwardApi,
    private spaceApi: SpaceApi
  ) {}

  public ngOnInit(): void {
    this.spaceApi.lastByRank(undefined, 3).pipe(untilDestroyed(this)).subscribe(this.spaces$);
    this.awardApi.lastByRank(undefined, 3).pipe(untilDestroyed(this)).subscribe(this.award$);
  }

  public onClickChangeTheme(theme: ThemeList): void {
    this.themeService.setTheme(theme);
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public get isLoggedIn(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public join(): void {
    if (this.auth.member$.value?.uid) {
      this.router.navigate(['/discover']);
    } else {
      this.signIn();
    }
  }

  public signIn(): void {
    this.auth.signIn().then((res) => {
      // Only redirect to dashboard if home.
      if (this.router.url === '/' && res) {
        this.router.navigate([ROUTER_UTILS.config.base.dashboard]);
      }
    });
  }

  public goToSoonLabsUrl(): void {
    window.location.href = 'https://www.soonlabs.com';
  }

  public goToIotaUrl(): void {
    window.location.href = 'https://www.soonlabs.com';
  }
}
