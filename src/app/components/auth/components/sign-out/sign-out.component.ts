import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { AuthService } from '../../services/auth.service';

@Component({
  templateUrl: './sign-out.component.html',
  styleUrls: ['./sign-out.component.less'],
  selector: 'wen-sign-out',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignOutComponent {
  returnUrl: string;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
  ) {
    this.returnUrl =
      this.activatedRoute.snapshot.queryParamMap.get('returnUrl') ||
      `/${ROUTER_UTILS.config.base.home}`;
  }

  onClickSignOut(): void {
    this.authService.signOut();
  }
}
