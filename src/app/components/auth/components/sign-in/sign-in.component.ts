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
  isVisible = false;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {
    this.returnUrl =
      this.activatedRoute.snapshot.queryParamMap.get('returnUrl') ||
      `/${ROUTER_UTILS.config.base.home}`;
  }

  onClickSignIn(): void {
    this.authService.signIn().then(() => {
      // Only redirect to dashboard if home.
      if (this.router.url === '/') {
        this.router.navigate([ROUTER_UTILS.config.base.dashboard]);
      }
    });
  }

  showModal(): void {
    this.isVisible = true;
  }

  handleCancel(): void {
    this.isVisible = false;
  }
}
