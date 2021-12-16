import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from "functions/interfaces/models";
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { SpaceApi } from './../../../../@api/space.api';
import { FilterService, SortOptions } from './../../services/filter.service';

export enum HOT_TAGS {
  ALL = 'All',
  OPEN = 'Open'
}

@UntilDestroy()
@Component({
  templateUrl: './spaces.page.html',
  styleUrls: ['./spaces.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpacesPage implements OnInit, OnDestroy {
  public sortControl: FormControl = new FormControl(SortOptions.OLDEST);
  public spaces$: BehaviorSubject<Space[]|undefined> = new BehaviorSubject<Space[]|undefined>(undefined);
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.OPEN];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);
  private dataStore: Space[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(private spaceApi: SpaceApi, public filter: FilterService) {
    // none.
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

  public handleChange(_checked: boolean, tag: string): void {
    this.selectedTags$.next([tag]);
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public getHandler(last?: any, search?: string): Observable<Space[]> {
    if (this.selectedTags$.value[0] === HOT_TAGS.OPEN) {
      if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
        return this.spaceApi.lastOpen(last, search);
      } else {
        return this.spaceApi.topOpen(last, search);
      }
    } else {
      if (this.filter.selectedSort$.value === SortOptions.OLDEST) {
        return this.spaceApi.last(last, search);
      } else {
        return this.spaceApi.top(last, search);
      }
    }
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.spaces$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    this.subscriptions$.push(this.getHandler(this.spaces$.value[this.spaces$.value.length - 1].createdOn).subscribe(this.store.bind(this, this.dataStore.length)));
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
    this.spaces$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.spaces$.pipe(map(() => {
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
