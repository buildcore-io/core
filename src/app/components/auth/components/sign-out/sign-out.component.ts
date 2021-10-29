import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { NzNotificationService } from "ng-zorro-antd/notification";
import { BehaviorSubject } from 'rxjs';
import { Member } from '../../../../../../functions/interfaces/models/member';
import { AuthService } from '../../services/auth.service';
import { MemberApi } from './../../../../@api/member.api';

@Component({
  templateUrl: './sign-out.component.html',
  styleUrls: ['./sign-out.component.less'],
  selector: 'wen-sign-out',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignOutComponent {
  returnUrl: string;

  constructor(
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    private memberApi: MemberApi,
    private notification: NzNotificationService
  ) {
    this.returnUrl =
      this.activatedRoute.snapshot.queryParamMap.get('returnUrl') ||
      `/${ROUTER_UTILS.config.base.home}`;
  }

  public get member$(): BehaviorSubject<Member|undefined> {
    return this.authService.member$;
  }

  public editName(name: string): void {
    console.log(this.member$.value);
    if (this.member$.value) {
      this.memberApi.updateMember({
        uid: this.member$.value.uid,
        name: name
      }).subscribe(() => {
        // TODO Add handling.
        this.notification.success('Updated.', '');
      });
    }
  }

  onClickSignOut(): void {
    this.authService.signOut();
  }
}
