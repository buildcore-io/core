import { ChangeDetectionStrategy, Component, EventEmitter, Inject, Input, LOCALE_ID, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { BehaviorSubject } from 'rxjs';
import { FILE_SIZES } from './../../../../../functions/interfaces/models/base';
import { Member } from './../../../../../functions/interfaces/models/member';

@Component({
  selector: 'wen-mobile-menu',
  templateUrl: './mobile-menu.component.html',
  styleUrls: ['./mobile-menu.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileMenuComponent {
  // TODO Clean up this passing around of inputs. This messy.
  @Input() isVisible = false;
  @Input() isMemberProfile = false;
  @Input() isLandingPage = false;
  @Input() isAllowedCreation = false;
  @Input() filesizes!: typeof FILE_SIZES;
  @Output() isVisibleChanged = new EventEmitter<boolean>();

  constructor(
    public auth: AuthService,
    private router: Router,
    @Inject(LOCALE_ID) private locale: string
  ) { }

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

  wenOnVisibleChange(isVisible: boolean): void {
    this.isVisible = isVisible;
    this.isVisibleChanged.emit(isVisible);
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public get member$(): BehaviorSubject<Member | undefined> {
    return this.auth.member$;
  }

  onClickProfile(): void {
    if(!this.auth.isLoggedIn$.value) {
      this.auth.signIn().then((res) => {
        // Only redirect to dashboard if home.
        if (this.router.url === '/' && res) {
          this.router.navigate([ROUTER_UTILS.config.base.dashboard]);
          this.wenOnVisibleChange(false);
        }
      });
    }
  }
}
