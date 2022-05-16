import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { SeoService } from '@core/services/seo';
import { ThemeService } from '@core/services/theme';
import { Observable } from 'rxjs';
import { CacheService } from './@core/services/cache/cache.service';
import { NavigationService } from './@core/services/navigation/navigation.service';

@Component({
  selector: 'wen-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default

})
export class WenComponent implements OnInit {
  isLoggedIn$!: Observable<boolean>;

  constructor(
    private seoService: SeoService,
    private themeService: ThemeService,
    private authService: AuthService,
    private navigation: NavigationService,
    private cacheService: CacheService
  ) {}

  public ngOnInit(): void {
    this.isLoggedIn$ = this.authService.isLoggedIn$;
    this.runGlobalServices();
    this.navigation.watchPathHistory();
    this.cacheService.initCache();
  }

  private runGlobalServices(): void {
    this.seoService.init();
    this.themeService.init();
  }
}
