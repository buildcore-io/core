import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';

@Component({
  selector: 'wen-sign-in-modal',
  templateUrl: './sign-in-modal.component.html',
  styleUrls: ['./sign-in-modal.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInModalComponent {
  constructor(public auth: AuthService) {}

  public handleCancel(): void {
    this.auth.hideWallet();
  }

  public onClickSignIn(): void {
    this.auth.signIn();
  }
}
