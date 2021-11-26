import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@components/auth/services/auth.service';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, skip, Subscription } from 'rxjs';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { SpaceApi } from './../../../../@api/space.api';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { DataService, MemberFilterOptions } from "./../../services/data.service";

@UntilDestroy()
@Component({
  selector: 'wen-members',
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPage implements OnInit, OnDestroy {
  public spaceId?: string;
  public selectedListControl: FormControl = new FormControl(MemberFilterOptions.ACTIVE);
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private notification: NotificationService,
    private route: ActivatedRoute,
    private router: Router,
    private cd: ChangeDetectorRef,
    public data: DataService
  ) {
    // none.
  }

  public get filterOptions(): typeof MemberFilterOptions {
    return MemberFilterOptions;
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

    this.data.guardians$.pipe(skip(1), untilDestroyed(this)).subscribe(() => {
      // Re-sync members.
      this.data.members$.next(this.data.members$.value);
    });

    this.selectedListControl.valueChanges.pipe(untilDestroyed(this)).subscribe(() => {
      this.onScroll();
      this.cd.markForCheck();
    });

    // Load initial list.
    this.onScroll();
  }

  public memberIsGuardian(memberId: string): boolean {
    if (!this.data.guardians$.value) {
      return false;
    }

    return this.data.guardians$.value.filter(e => e.uid === memberId).length > 0;
  }

  public getList(): BehaviorSubject<Member[]|undefined> {
    if (this.selectedListControl.value === this.filterOptions.PENDING) {
      return this.data.pendingMembers$;
    } else if (this.selectedListControl.value === this.filterOptions.BLOCKED) {
      return this.data.blockedMembers$;
    } else {
      return this.data.members$;
    }
  }

  public getTitle(): string {
    if (this.selectedListControl.value === this.filterOptions.PENDING) {
      return 'Pending';
    } else if (this.selectedListControl.value === this.filterOptions.BLOCKED) {
      return 'Blocked';
    } else {
      return 'Active';
    }
  }

  public isActiveList(): boolean {
    return this.selectedListControl.value === MemberFilterOptions.ACTIVE;
  }

  public isBlockedList(): boolean {
    return this.selectedListControl.value === MemberFilterOptions.BLOCKED;
  }

  public isPendingList(): boolean {
    return this.selectedListControl.value === MemberFilterOptions.PENDING;
  }

  public onScroll(): void {
    if (!this.spaceId) {
      return;
    }

    this.data.onMemberScroll(this.spaceId, this.selectedListControl.value);
  }

  public async setGuardian(memberId: string): Promise<void> {
    if (!this.spaceId) {
      return;
    }

    await this.auth.sign({
      uid: this.spaceId,
      member: memberId
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.setGuardian(sc), 'Member made a guardian.', finish).subscribe((val: any) => {
        // none
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
      this.notification.processRequest(this.spaceApi.removeGuardian(sc), 'Member removed as guardian.', finish).subscribe((val: any) => {
        // none.
      });
    });

  }

  public async blockMember(memberId: string): Promise<void> {
    if (!this.spaceId) {
      return;
    }

    await this.auth.sign({
      uid: this.spaceId,
      member: memberId
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.blockMember(sc), 'Member blocked.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }

  public async acceptMember(memberId: string): Promise<void> {
    if (!this.spaceId) {
      return;
    }

    await this.auth.sign({
      uid: this.spaceId,
      member: memberId
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.acceptMember(sc), 'Member accepted.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }

  public async rejectMember(memberId: string): Promise<void> {
    if (!this.spaceId) {
      return;
    }

    await this.auth.sign({
      uid: this.spaceId,
      member: memberId
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.rejectMember(sc), 'Member rejected.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }

  public async unblockMember(memberId: string): Promise<void> {
    if (!this.spaceId) {
      return;
    }

    await this.auth.sign({
      uid: this.spaceId,
      member: memberId
    }, (sc, finish) => {
      this.notification.processRequest(this.spaceApi.unblockMember(sc), 'Member unblocked.', finish).subscribe((val: any) => {
        // none.
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
