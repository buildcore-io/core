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
  img: string;
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
      img: '/assets/mocks/build_dao_banner.jpg',
      title: $localize`Create your community`,
      description: $localize`Feeless, secure, on-chain voting, and “one click” creation tools.`
    },
    {
      img: '/assets/mocks/manage_dao_banner.jpg',
      title: $localize`Build reputation and rewards`,
      description: $localize`Create incentives and build reputation, trust and community engagement.`
    },
    {
      img: '/assets/mocks/own_dao_banner.jpg',
      title: $localize`Manage, Maintain, Grow`,
      description: $localize`Governance, voting, for both public and private communities.`
    }
  ];

  constructor(
    public deviceService: DeviceService,
    private auth: AuthService,
    private themeService: ThemeService,
    private router: Router,
    private collectionApi: CollectionApi,
    private spaceApi: SpaceApi
  ) {}

  public ngOnInit(): void {
    this.spaceApi.last(undefined, undefined, 3).pipe(untilDestroyed(this)).subscribe(this.spaces$);
    this.collectionApi.last(undefined, undefined, 3).pipe(untilDestroyed(this)).subscribe(this.collection$);
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

  public goToManifesto(): void {
    window.open(
      'https://github.com/soonlabs/soonaverse-dao/blob/main/MANIFESTO.md',
      '_blank'
    );
  }

  public goToSoonLabsUrl(): void {
    window.open(
      'https://github.com/soonlabs/soonaverse-dao',
      '_blank'
    );
  }

  public goToYoutube(): void {
    window.open(
      'https://www.youtube.com/channel/UCUxPJ-wMgz7DnEFWpW5b48w',
      '_blank'
    );
  }

  public goToIotaUrl(): void {
    window.open(
      'https://github.com/soonlabs/soonaverse-dao',
      '_blank'
    );
  }
}
