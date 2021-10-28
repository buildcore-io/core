import { ConfigApi } from './@api/config.api';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { SeoService } from '@core/services/seo';
import { ThemeService } from '@core/services/theme';
import { Observable } from 'rxjs';

@Component({
  selector: 'wen-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WenComponent implements OnInit {
  isLoggedIn$!: Observable<boolean>;

  constructor(
    private seoService: SeoService,
    private themeService: ThemeService,
    private authService: AuthService,
    private apiConfig: ConfigApi
  ) {}

  ngOnInit(): void {
    this.isLoggedIn$ = this.authService.isLoggedIn$;
    this.runGlobalServices();
  }

  private runGlobalServices(): void {
    this.seoService.init();
    this.themeService.init();

    // Test config API.
    this.apiConfig.latest().subscribe((e) => {
      console.log(e);
      console.log(e.createdOn.toDate());
    });
  }
}
