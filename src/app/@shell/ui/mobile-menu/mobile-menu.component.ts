import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models';
import { FILE_SIZES } from './../../../../../functions/interfaces/models/base';

@Component({
  selector: 'wen-mobile-menu',
  templateUrl: './mobile-menu.component.html',
  styleUrls: ['./mobile-menu.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileMenuComponent {
  @Input() isVisible = false;
  @Input() isLoggedIn$ = new BehaviorSubject<boolean>(false);
  @Input() isMemberProfile = false;
  @Input() isLandingPage = false;
  @Input() isAllowedCreation = false;
  @Input() urlToNewSpace = '';
  @Input() urlToNewProposal = '';
  @Input() urlToNewAward = '';
  @Input() member$ = new BehaviorSubject<Member | undefined>(undefined);
  @Input() filesizes!: typeof FILE_SIZES;
  @Output() isVisibleChanged = new EventEmitter<boolean>();

  constructor(
    public auth: AuthService,
    private router: Router
  ) { }

  onVisibleChange(isVisible: boolean): void {
    this.isVisible = isVisible;
    this.isVisibleChanged.emit(isVisible);
  }

  onClickProfile(): void {
    if(!this.isLoggedIn$.getValue()) {
      this.auth.signIn().then((res) => {
        // Only redirect to dashboard if home.
        if (this.router.url === '/' && res) {
          this.router.navigate([ROUTER_UTILS.config.base.dashboard]);
          this.onVisibleChange(false);
        }
      });
    }
  }
}
