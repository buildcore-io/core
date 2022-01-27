import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { SelectBoxOption } from '@components/select-box/select-box.component';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { SortOptions } from "../../services/sort-options.interface";
import { Member } from './../../../../../../functions/interfaces/models/member';
import { Space } from './../../../../../../functions/interfaces/models/space';
import { DEFAULT_LIST_SIZE, FULL_LIST } from './../../../../@api/base.api';
import { MemberApi } from './../../../../@api/member.api';
import { SpaceApi } from './../../../../@api/space.api';
import { AuthService } from './../../../../components/auth/services/auth.service';
import { MemberAllianceItem } from './../../../../components/member/components/member-reputation-modal/member-reputation-modal.component';
import { FilterService } from './../../services/filter.service';

export const DEFAULT_SPACE: SelectBoxOption = {
  label: 'All',
  value: 'all'
};

@UntilDestroy()
@Component({
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPage implements OnInit, OnDestroy {
  public sortControl: FormControl;
  public spaceForm: FormGroup;
  public spaceList$ = new BehaviorSubject<Space[]>([]);
  public members$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public defaultSpace = DEFAULT_SPACE;
  private dataStore: Member[][] = [];
  private subscriptions$: Subscription[] = [];
  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    private memberApi: MemberApi,
    private spaceApi: SpaceApi,
    private auth: AuthService,
    private cd: ChangeDetectorRef
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.spaceForm = new FormGroup({
      space: new FormControl(DEFAULT_SPACE.value),
      includeAlliances: new FormControl(false)
    });
  }

  public ngOnInit(): void {
    this.listen();
    this.filter.selectedSort$.pipe(skip(1), untilDestroyed(this)).subscribe(() => {
      this.listen();
    });

    this.filter.search$.pipe(skip(1), untilDestroyed(this)).subscribe((val: any) => {
      if (val && val.length > 0) {
        this.listen(val);
      } else {
        this.listen();
      }
    });

    this.sortControl.valueChanges.pipe(untilDestroyed(this)).subscribe((val: any) => {
      this.filter.selectedSort$.next(val);
    });

    this.spaceApi.alphabetical(undefined, undefined, FULL_LIST).subscribe(this.spaceList$);
    // this.spaceForm.valueChanges.pipe(untilDestroyed(this)).subscribe((val: any) => {
    //   const space: Space | undefined = this.spaceList$.value.find((s) => {
    //     return s.uid === val.space;
    //   });

    //   // Unable to find space.
    //   if (!space) {
    //     return;
    //   }

    //   console.log(space);
    //   this.cd.markForCheck();
    // });
  }

  public getAlliances(member: Member): MemberAllianceItem[] {
    const out: MemberAllianceItem[] = [];
    const space: Space | undefined = this.spaceList$.value.find((s) => {
      return s.uid === this.spaceForm.value.space;
    });
    // It self.
    if (space && this.spaceForm.value.space !== this.defaultSpace.value) {
      if (this.spaceForm.value.includeAlliances) {
        for (const [spaceId, values] of Object.entries(space?.alliances || {})) {
          const allianceSpace: Space | undefined = this.spaceList$.value.find((s) => {
            return s.uid === spaceId;
          });
          if (
            allianceSpace &&
            values.enabled === true
          ) {
            out.push({
              avatar: allianceSpace.avatarUrl,
              name: allianceSpace.name || allianceSpace.uid,
              totalAwards: member.statsPerSpace?.[allianceSpace.uid]?.awardsCompleted || 0,
              totalXp: member.statsPerSpace?.[allianceSpace.uid]?.totalReputation || 0
            });
          }
        }
      }

      out.push({
        avatar: space.avatarUrl,
        name: space.name || space.uid,
        totalAwards: member.statsPerSpace?.[space.uid]?.awardsCompleted || 0,
        totalXp: member.statsPerSpace?.[space.uid]?.totalReputation || 0
      });
    }

    return out;
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public getSpaceListOptions(list?: Space[] | null): SelectBoxOption[] {
    // console.log(list);
    return [DEFAULT_SPACE].concat((list || []).map((o) => {
      return {
        label: o.name || o.uid,
        value: o.uid
      };
    }));
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public getHandler(last?: any, search?: string): Observable<Member[]> {
    if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
      return this.memberApi.last(last, search);
    } else {
      return this.memberApi.top(last, search);
    }
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.members$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    this.subscriptions$.push(this.getHandler(this.members$.value[this.members$.value.length - 1].createdOn).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.members$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.members$.pipe(map(() => {
      if (!this.dataStore[this.dataStore.length - 1]) {
        return true;
      }

      return (!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE);
    }));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.dataStore = [];
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
  }
}
