import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { ThemeList, ThemeService } from '@core/services/theme';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Collection, Space } from '@functions/interfaces/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';
import { SpaceApi } from './../../@api/space.api';

export interface StepArticle {
  imgLight: string;
  imgDark: string;
  title: string;
  description: string;
}

@UntilDestroy()
@Component({
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage implements OnInit {
  public path = ROUTER_UTILS.config;
  public theme = ThemeList;
  public collection$: BehaviorSubject<Collection[]> = new BehaviorSubject<Collection[]>([]);
  public spaces$: BehaviorSubject<Space[]> = new BehaviorSubject<Space[]>([]);
  public stepArticles: StepArticle[] = [
    {
      imgLight: '/assets/mocks/build_dao_banner.jpg',
      imgDark: '/assets/mocks/build_dao_banner_dark.jpg',
      title: $localize`Create your community`,
      description: $localize`Feeless, secure, on-chain voting, and “one click” creation tools.`
    },
    {
      imgLight: '/assets/mocks/manage_dao_banner.jpg',
      imgDark: '/assets/mocks/manage_dao_banner_dark.png',
      title: $localize`Build reputation and rewards`,
      description: $localize`Create incentives and build reputation, trust and community engagement.`
    },
    {
      imgLight: '/assets/mocks/own_dao_banner.jpg',
      imgDark: '/assets/mocks/own_dao_banner_dark.jpg',
      title: $localize`Manage, Maintain, Grow`,
      description: $localize`Governance, voting, for both public and private communities.`
    }
  ];

  constructor(
    public deviceService: DeviceService,
    public themeService: ThemeService,
    private auth: AuthService,
    private router: Router,
    private collectionApi: CollectionApi,
    private spaceApi: SpaceApi
  ) { }

  public ngOnInit(): void {
    this.spaceApi.last(undefined, undefined, 3).pipe(untilDestroyed(this)).subscribe(this.spaces$);
    this.collectionApi.last(undefined, undefined, 3).pipe(untilDestroyed(this)).subscribe(this.collection$);
  }

  public onClickChangeTheme(theme: ThemeList): void {
    this.themeService.setTheme(theme);
  }

  public trackByUid(index: number, item: Space | Collection) {
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

  public goToManifesto(): void {
    window?.open(
      'https://github.com/soonaverse/soonaverse-dao/blob/main/MANIFESTO.md',
      '_blank'
    );
  }

  public goToYoutube(): void {
    window?.open(
      'https://www.youtube.com/channel/UCUxPJ-wMgz7DnEFWpW5b48w',
      '_blank'
    );
  }
}
