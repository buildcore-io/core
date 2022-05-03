import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Space } from "functions/interfaces/models";
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';
import { SortOptions } from "../../services/sort-options.interface";
import { DEFAULT_LIST_SIZE } from './../../../../@api/base.api';
import { SpaceApi } from './../../../../@api/space.api';
import { FilterService } from './../../services/filter.service';
import {AlgoliaService} from "@Algolia/services/algolia.service";
import {discoverSections} from "@pages/discover/pages/discover/discover.page";
import {defaultPaginationItems} from "@Algolia/algolia.options";

export enum HOT_TAGS {
  ALL = 'All',
  OPEN = 'Open'
}

@UntilDestroy()
@Component({
  templateUrl: './spaces.page.html',
  styleUrls: ['./spaces.page.less'],
  // changeDetection: ChangeDetectionStrategy.OnPush
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Default

})
export class SpacesPage implements OnInit, OnDestroy {
  config = {
    indexName: 'space',
    searchClient: this.algoliaService.searchClient,
  };
  sections = discoverSections;
  sortItems = [
    { value: 'space', label: 'recent' },
    { value: 'space_createdOn_desc', label: 'Oldest' },
  ];
  paginationItems = defaultPaginationItems;

  public sortControl: FormControl;
  public spaces$: BehaviorSubject<Space[]|undefined> = new BehaviorSubject<Space[]|undefined>(undefined);
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.OPEN];
  public hotTagsLabels: { [key: string]: string } = {
    [HOT_TAGS.ALL]: $localize`All`,
    [HOT_TAGS.OPEN]: $localize`Open`
  }
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);
  private dataStore: Space[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    private spaceApi: SpaceApi,
    public filter: FilterService,
    public deviceService: DeviceService,
    public readonly algoliaService: AlgoliaService,
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
  }

  public ngOnInit(): void {
    this.filter.selectedSort$.pipe(skip(1), untilDestroyed(this)).subscribe(() => {
      if (this.filter.search$.value && this.filter.search$.value.length > 0) {
        this.listen(this.filter.search$.value);
      } else {
        this.listen();
      }
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
      if (this.filter.search$.value && this.filter.search$.value.length > 0) {
        this.listen(this.filter.search$.value);
      } else {
        this.listen();
      }
    });
  }

  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.spaces$.next(undefined);
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

    this.subscriptions$.push(this.getHandler(this.spaces$.value[this.spaces$.value.length - 1]._doc).subscribe(this.store.bind(this, this.dataStore.length)));
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
    return <BehaviorSubject<boolean>> this.spaces$.pipe(map(() => {
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
