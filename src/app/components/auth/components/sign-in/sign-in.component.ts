import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { AuthService } from '../../services/auth.service';

@Component({
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.less'],
  selector: 'wen-sign-in',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignInComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
  ) {
    // none.
  }
}
