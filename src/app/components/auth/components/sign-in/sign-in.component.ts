import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { AuthService } from '../../services/auth.service';

@Component({
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.less'],
  selector: 'wen-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignInComponent {
  returnUrl: string;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {
    this.returnUrl =
      this.activatedRoute.snapshot.queryParamMap.get('returnUrl') ||
      `/${ROUTER_UTILS.config.base.home}`;
  }

  onClickSignIn(): void {
    this.authService.signIn().then(() => {
      this.router.navigate([ROUTER_UTILS.config.base.dashboard]);
    });
  }
}
