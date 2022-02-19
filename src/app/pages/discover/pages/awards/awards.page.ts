import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { SortOptions } from "../../services/sort-options.interface";
import { Award } from './../../../../../../functions/interfaces/models/award';
import { AwardApi } from './../../../../@api/award.api';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { FilterService } from './../../services/filter.service';

export enum HOT_TAGS {
  ALL = 'All',
  ACTIVE = 'Active',
  COMPLETED = 'Completed'
}

@UntilDestroy()
@Component({
  templateUrl: './awards.page.html',
  styleUrls: ['./awards.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class AwardsPage implements OnInit, OnDestroy {
  public sortControl: FormControl;
  public award$: BehaviorSubject<Award[]|undefined> = new BehaviorSubject<Award[]|undefined>(undefined);
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.ACTIVE, HOT_TAGS.COMPLETED];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ACTIVE]);
  private dataStore: Award[][] = [];
  private subscriptions$: Subscription[] = [];
  constructor(
    private awardApi: AwardApi,
    public filter: FilterService,
    public deviceService: DeviceService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
  }

  public ngOnInit(): void {
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

    // Init listen.
    this.selectedTags$.pipe(untilDestroyed(this)).subscribe(() => {
      this.listen();
    });
  }

  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public getHandler(last?: any, search?: string): Observable<Award[]> {
    if (this.selectedTags$.value[0] === HOT_TAGS.ACTIVE) {
      if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
        return this.awardApi.lastActive(last, search);
      } else {
        return this.awardApi.topActive(last, search);
      }
    } else if (this.selectedTags$.value[0] === HOT_TAGS.COMPLETED) {
      if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
        return this.awardApi.lastCompleted(last, search);
      } else {
        return this.awardApi.topCompleted(last, search);
      }
    } else {
      if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
        return this.awardApi.last(last, search);
      } else {
        return this.awardApi.top(last, search);
      }
    }
  }


  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.award$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    this.subscriptions$.push(this.getHandler(this.award$.value[this.award$.value.length - 1]._doc).subscribe(this.store.bind(this, this.dataStore.length)));
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
    this.award$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.award$.pipe(map(() => {
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
    this.award$.next(undefined);
  }
}
