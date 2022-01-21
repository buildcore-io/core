import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { SelectBoxOption } from '@components/select-box/select-box.component';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { SortOptions } from "../../services/sort-options.interface";
import { Member } from './../../../../../../functions/interfaces/models/member';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { MemberApi } from './../../../../@api/member.api';
import { FilterService } from './../../services/filter.service';

export enum HOT_TAGS {
  ALL = 'All'
}

@UntilDestroy()
@Component({
  templateUrl: './members.page.html',
  styleUrls: ['./members.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPage implements OnInit, OnDestroy {
  public sortControl: FormControl;
  public members$: BehaviorSubject<Member[]|undefined> = new BehaviorSubject<Member[]|undefined>(undefined);
  public hotTags: string[] = [HOT_TAGS.ALL];
  public hotTagsFormatted: SelectBoxOption[] = [];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);
  private dataStore: Member[][] = [];
  private subscriptions$: Subscription[] = [];
  constructor(
    private memberApi: MemberApi, 
    public filter: FilterService,
    public deviceService: DeviceService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
  }

  public ngOnInit(): void {
    this.hotTagsFormatted = this.hotTags.map((tag: string) => ({ value: tag, label: tag }));
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
  }

  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
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
