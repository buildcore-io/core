import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { SelectBoxOption, SelectBoxSizes } from '@components/select-box/select-box.component';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { SortOptions } from "../../services/sort-options.interface";
import { cyrb53 } from "./../../../../../../functions/interfaces/hash.utils";
import { Member } from './../../../../../../functions/interfaces/models/member';
import { Space } from './../../../../../../functions/interfaces/models/space';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { MemberApi } from './../../../../@api/member.api';
import { CacheService } from './../../../../@core/services/cache/cache.service';
import { AuthService } from './../../../../components/auth/services/auth.service';
import { FilterService } from './../../services/filter.service';

export const DEFAULT_SPACE: SelectBoxOption = {
  label: 'All Spaces',
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
  public members$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public defaultSpace = DEFAULT_SPACE;
  public selectBoxSizes = SelectBoxSizes;
  private dataStore: Member[][] = [];
  private subscriptions$: Subscription[] = [];
  private spaceControl: FormControl;
  private includeAlliancesControl: FormControl;
  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public cache: CacheService,
    private memberApi: MemberApi,
    private auth: AuthService,
    private storageService: StorageService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.spaceControl = new FormControl(storageService.selectedSpace.getValue());
    this.includeAlliancesControl = new FormControl(storageService.isIncludeAlliancesChecked.getValue());
    this.spaceForm = new FormGroup({
      space: this.spaceControl,
      includeAlliances: this.includeAlliancesControl
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

    this.spaceForm.valueChanges
      .pipe(untilDestroyed(this))
      .subscribe((o) => {
        if (o.space === this.defaultSpace.value && o.includeAlliances) {
          this.spaceForm.controls.includeAlliances.setValue(false);
          return;
        }
        this.storageService.selectedSpace.next(o.space);
        this.storageService.isIncludeAlliancesChecked.next(o.includeAlliances);
        this.listen();
    });
  }

  public get isLoggedIn$(): BehaviorSubject<boolean> {
    return this.auth.isLoggedIn$;
  }

  public getSpaceListOptions(list?: Space[] | null): SelectBoxOption[] {
    return [DEFAULT_SPACE].concat((list || []).map((o) => {
      return {
        label: o.name || o.uid,
        value: o.uid,
        img: o.avatarUrl
      };
    }));
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public getHandler(last?: any, search?: string): Observable<Member[]> {
    if (this.spaceControl.value === this.defaultSpace.value) {
      if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
        return this.memberApi.last(last, search);
      } else {
        return this.memberApi.top(last, search);
      }
    } else {
      // TODO Generate this based on the space.
      const space: Space | undefined = this.cache.allSpaces$.value.find((s) => {
        return s.uid === this.spaceControl.value;
      });
      let linkedEntity = -1;
      if (space) {
        if (this.includeAlliancesControl.value) {
          linkedEntity = cyrb53([space.uid, ...Object.keys(space.alliances || {})].join(''));
        } else {
          linkedEntity = cyrb53(space.uid);
        }
      }

      if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
        return this.memberApi.last(last, search, DEFAULT_LIST_SIZE, linkedEntity);
      } else {
        return this.memberApi.top(last, search, DEFAULT_LIST_SIZE, linkedEntity);
      }
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
