import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { undefinedToEmpty } from '@core/utils/manipulations.utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { SpaceGuardian } from 'functions/interfaces/models';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject, skip, Subscription } from 'rxjs';
import { WenRequest } from './../../../../../../functions/interfaces/models/base';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { SpaceApi } from './../../../../@api/space.api';

@UntilDestroy()
@Component({
  selector: 'wen-members',
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPage implements OnInit, OnDestroy {
  public spaceId?: string;
  public members$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public guardians$: BehaviorSubject<SpaceGuardian[]|undefined> = new BehaviorSubject<SpaceGuardian[]|undefined>(undefined);
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private notification: NzNotificationService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.route.parent?.params.subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.space.space.replace(':', '')];
      if (id) {
        this.cancelSubscriptions();
        this.listenToIsMemberAndGuardian(id);
        this.spaceId = id;
      } else {
        this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
      }
    });

    this.guardians$.pipe(skip(1)).subscribe(() => {
      // Re-sync members.
      this.members$.next(this.members$.value);
    });
  }

  private listenToIsMemberAndGuardian(spaceId: string): void {
    this.subscriptions$.push(this.spaceApi.listenMembers(spaceId).pipe(untilDestroyed(this)).subscribe(this.members$));
    this.subscriptions$.push(this.spaceApi.listenGuardians(spaceId).pipe(untilDestroyed(this)).subscribe(this.guardians$));
  }

  public memberIsGuardian(memberId: string): boolean {
    if (!this.guardians$.value) {
      return false;
    }

    return this.guardians$.value.filter(e => e.uid === memberId).length > 0;
  }

  public loggedInMemberIsGuardian(): boolean {
    if (!this.guardians$.value) {
      return false;
    }

    const currentMemberId: string | undefined = this.auth.member$?.value?.uid;
    if (!currentMemberId) {
      return false;
    }

    return this.guardians$.value.filter(e => e.uid === currentMemberId).length > 0;
  }

  public async setGuardian(memberId: string): Promise<void> {
    if (!this.spaceId) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.signWithMetamask(
      undefinedToEmpty({
        uid: this.spaceId,
        member: memberId
      })
    );

    if (!sc) {
      throw new Error('Unable to sign.');
    }

    this.spaceApi.setGuardian(sc).subscribe(() => {
      this.notification.success('Member made a guardian.', '');
    });
  }

  public async removeGuardian(memberId: string): Promise<void> {
    if (!this.spaceId) {
      return;
    }

    const sc: WenRequest|undefined =  await this.auth.signWithMetamask(
      undefinedToEmpty({
        uid: this.spaceId,
        member: memberId
      })
    );

    if (!sc) {
      throw new Error('Unable to sign.');
    }

    this.spaceApi.removeGuardian(sc).subscribe(() => {
      this.notification.success('Member removed as guardian.', '');
    });
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
