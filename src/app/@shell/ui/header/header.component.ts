import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { BehaviorSubject } from 'rxjs';
import { Member } from './../../../../../functions/interfaces/models/member';

@Component({
  selector: 'wen-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  public path = ROUTER_UTILS.config.base;
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.authService.isLoggedIn$;
  }

  public get member$(): BehaviorSubject<Member|undefined> {
    return this.authService.member$;
  }

  public get urlToNewSpace(): string {
    return '/' + ROUTER_UTILS.config.space.root + '/new';
  }

  public get urlToNewProposal(): string {
    return '/' + ROUTER_UTILS.config.proposal.root + '/new';
  }

  public get urlToNewAward(): string {
    return '/' + ROUTER_UTILS.config.award.root + '/new';
  }

  public goToMyProfile(): void {
    if (this.member$.value?.uid) {
      this.router.navigate([ROUTER_UTILS.config.member.root, this.member$.value.uid]);
    }
  }

  public onClickSignOut(): void {
    this.authService.signOut();
  }

  public onClickSignIn(): void {
    this.authService.signIn();
  }
}
