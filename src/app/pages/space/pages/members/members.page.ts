import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MemberApi } from "@api/member.api";
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from "functions/interfaces/models";
import { BehaviorSubject, debounceTime, firstValueFrom, skip, Subscription } from 'rxjs';
import { GLOBAL_DEBOUNCE_TIME } from './../../../../../../functions/interfaces/config';
import { Member } from './../../../../../../functions/interfaces/models/member';
import { SpaceApi } from './../../../../@api/space.api';
import { NotificationService } from './../../../../@core/services/notification/notification.service';
import { MemberAllianceItem } from './../../../../components/member/components/member-reputation-modal/member-reputation-modal.component';
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
  public search$: BehaviorSubject<string|undefined> = new BehaviorSubject<string|undefined>(undefined);
  public filterControl: FormControl = new FormControl(undefined);
  public overTenRecords = false;
  public static DEBOUNCE_TIME = GLOBAL_DEBOUNCE_TIME;
  private subscriptions$: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private spaceApi: SpaceApi,
    private memberApi: MemberApi,
    private notification: NotificationService,
    private route: ActivatedRoute,
    private router: Router,
    private cd: ChangeDetectorRef,
    public data: DataService,
    public deviceService: DeviceService
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
      if (this.search$.value && this.search$.value.length > 0) {
        this.search$.next(this.search$.value);
      } else {
        this.onScroll();
      }
      this.cd.markForCheck();
    });

    this.search$.pipe(skip(1), untilDestroyed(this)).subscribe(async (val) => {
      // We need reset old values.
      this.data.resetMembersDataStore();
      this.data.resetMembersSubjects();
      this.overTenRecords = false;
      if (val && val.length > 0) {
        const obj: Member[] = await firstValueFrom(this.memberApi.last(undefined, val));
        const ids: string[] = obj.map((o) => {
          return o.uid;
        });

        // Top 10 records only supported
        this.overTenRecords = ids.length > 10;
        this.onScroll(ids.slice(0, 10));
      } else {

        // Show normal list again.
        this.onScroll();
      }
    });

    this.filterControl.valueChanges.pipe(
      debounceTime(MembersPage.DEBOUNCE_TIME)
    ).subscribe(this.search$);

    // Load initial list.
    this.onScroll();
  }

  public handleFilterChange(filter: MemberFilterOptions): void {
    this.selectedListControl.setValue(filter);
    this.cd.markForCheck();
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

  public getAlliances(member: Member): MemberAllianceItem[] {
    const out: MemberAllianceItem[] = [];
    for (const [spaceId, values] of Object.entries(this.data.space$.value?.alliances || {})) {
      const allianceSpace: Space | undefined = this.data.allSpaces$.value.find((s) => {
        return s.uid === spaceId;
      });
      if (
        allianceSpace &&
        values.enabled === true
      ) {
        out.push({
          avatar: allianceSpace.avatarUrl,
          name: allianceSpace.name || allianceSpace.uid,
          weight: values.weight,
          totalAwards: member.statsPerSpace?.[allianceSpace.uid]?.awardsCompleted || 0,
          totalXp: member.statsPerSpace?.[allianceSpace.uid]?.totalReputation || 0
        });
      }
    }

    out.push({
      avatar: this.data.space$.value!.avatarUrl,
      name: this.data.space$.value!.name || this.data.space$.value!.uid,
      weight: 1,
      totalAwards: member.statsPerSpace?.[this.data.space$.value!.uid]?.awardsCompleted || 0,
      totalXp: member.statsPerSpace?.[this.data.space$.value!.uid]?.totalReputation || 0
    });

    return out;
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

  public onScroll(searchIds?: string[]): void {
    if (!this.spaceId) {
      return;
    }

    this.data.onMemberScroll(this.spaceId, this.selectedListControl.value, searchIds);
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
      this.notification.processRequest(this.spaceApi.rejectMember(sc), 'Member ignored.', finish).subscribe((val: any) => {
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
    this.search$.next(undefined);
    this.cancelSubscriptions();
  }
}
