import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { NzNotificationService } from "ng-zorro-antd/notification";
import { BehaviorSubject } from 'rxjs';
import { Member } from '../../../../../../functions/interfaces/models/member';
import { AuthService } from '../../services/auth.service';
import { MemberApi } from './../../../../@api/member.api';
import { MetamaskSignature } from './../../services/auth.service';

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

  public async editName(name: string): Promise<void> {
    if (this.member$.value) {
      const sc: MetamaskSignature|undefined =  await this.authService.signWithMetamask({
        uid: this.member$.value.uid,
        name: name
      });
      if (!sc) {
        throw new Error('Unable to sign.');
      }

      this.memberApi.updateMember(sc.token).subscribe(() => {
        // TODO Cleanup handling.
        this.notification.success('Updated.', '');
      });
    }
  }

  onClickSignOut(): void {
    this.authService.signOut();
  }
}
