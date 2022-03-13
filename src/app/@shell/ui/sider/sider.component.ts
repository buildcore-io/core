import { ChangeDetectionStrategy, Component, Inject, LOCALE_ID } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy } from '@ngneat/until-destroy';

@UntilDestroy()
@Component({
  selector: 'wen-sider',
  templateUrl: './sider.component.html',
  styleUrls: ['./sider.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SiderComponent {
  public homeRoute = ROUTER_UTILS.config.base.home;

  constructor(
    public auth: AuthService,
    @Inject(LOCALE_ID) private locale: string
  ) {}

  public isEnglish(): boolean {
    return this.locale === 'en';
  }

  public goToEn(): void {
    // Force English.
    document.cookie = "firebase-language-override=en";
    setTimeout(() => {
      window.location.href = '//' + window.location.host;
    }, 100);
  }
}
