import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy } from '@ngneat/until-destroy';
import { skip, Subscription } from 'rxjs';
import { SpaceApi } from './../../../../@api/space.api';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { DataService } from "./../../services/data.service";

@UntilDestroy()
@Component({
  selector: 'wen-members',
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPage implements OnInit, OnDestroy {
  public spaceId?: string;
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private notification: NotificationService,
    private route: ActivatedRoute,
    private router: Router,
    public data: DataService
  ) {
    // none.
  }

  public ngOnInit(): void {
    this.route.parent?.params.subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.space.space.replace(':', '')];
      if (id) {
        this.cancelSubscriptions();
        this.spaceId = id;
      } else {
        this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
      }
    });

    this.data.guardians$.pipe(skip(1)).subscribe(() => {
      // Re-sync members.
      this.data.members$.next(this.data.members$.value);
    });
  }

  public memberIsGuardian(memberId: string): boolean {
    if (!this.data.guardians$.value) {
      return false;
    }

    return this.data.guardians$.value.filter(e => e.uid === memberId).length > 0;
  }

  public async setGuardian(memberId: string): Promise<void> {
    if (!this.spaceId) {
      return;
    }

    await this.auth.sign({
      uid: this.spaceId,
      member: memberId
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.setGuardian(sc), 'Member made a guardian.').subscribe((val: any) => {
        finish();
      });
    });

  }

  public async removeGuardian(memberId: string): Promise<void> {
    if (!this.spaceId) {
      return;
    }

    await this.auth.sign({
      uid: this.spaceId,
      member: memberId
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.removeGuardian(sc), 'Member removed as guardian.').subscribe((val: any) => {
        finish();
      });
    });

  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
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
