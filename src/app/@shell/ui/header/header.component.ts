import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'wen-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  path = ROUTER_UTILS.config.base;

  constructor(private router: Router, private authService: AuthService) {}

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.authService.isLoggedIn$;
  }

  onClickSignOut(): void {
    this.authService.signOut();
  }

  onClickSignIn(): void {
    this.authService.signIn();
  }
}
