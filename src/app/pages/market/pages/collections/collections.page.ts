import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { CollectionApi } from '@api/collection.api';
import { DEFAULT_SPACE, SelectSpaceOption } from '@components/space/components/select-space/select-space.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FilterService } from '@pages/market/services/filter.service';
import { SortOptions } from '@pages/market/services/sort-options.interface';
import { Categories, Collection, CollectionAccess, Space } from 'functions/interfaces/models';
import { BehaviorSubject, map, Observable, skip, Subscription } from 'rxjs';

export enum HOT_TAGS {
  ALL = 'All',
  OPEN_SALE_ONLY = 'Open Sale Only',
  MEMBERS_ONLY = 'Members Only',
  SPACE = 'SPACE',
  CATEGORY = 'CATEGORY'
}

export enum AddedCategories {
  ALL = 'All'
}

@UntilDestroy()
@Component({
  selector: 'wen-collections',
  templateUrl: './collections.page.html',
  styleUrls: ['./collections.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionsPage implements OnInit, OnDestroy {
  public sortControl: FormControl;
  public spaceControl: FormControl;
  public categoryControl: FormControl;
  public collections$: BehaviorSubject<Collection[]|undefined> = new BehaviorSubject<Collection[]|undefined>(undefined);
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.OPEN_SALE_ONLY, HOT_TAGS.MEMBERS_ONLY];
  public categories: string[] = [AddedCategories.ALL, Categories.ABSTRACT, Categories.ANIMATION, Categories.ART,
                                Categories.COLLECTIBLE, Categories.GENERATIVE, Categories.INTERACTIVE, Categories.PFP,
                                Categories.PHOTOGRAPHY, Categories.PIXELART, Categories.SINGLE, Categories.THREE_D ];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);
  private dataStore: Collection[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public filter: FilterService,
    public collectionApi: CollectionApi,
    public deviceService: DeviceService,
    public cache: CacheService,
    private storageService: StorageService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.spaceControl = new FormControl(this.storageService.selectedSpace.getValue());
    this.categoryControl = new FormControl(AddedCategories.ALL);
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
    this.selectedTags$.pipe(untilDestroyed(this)).subscribe((o) => {
      if (o.indexOf(HOT_TAGS.CATEGORY) === -1 && this.categoryControl.value !== AddedCategories.ALL) {
        this.categoryControl.setValue(AddedCategories.ALL, { emitEvent: false })
      }

      if (o.indexOf(HOT_TAGS.SPACE) === -1 && this.spaceControl.value !== DEFAULT_SPACE.value) {
        this.spaceControl.setValue(DEFAULT_SPACE.value, { emitEvent: false })
      }

      this.listen();
    });

    this.spaceControl.valueChanges.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj && obj !== DEFAULT_SPACE.value && this.selectedTags$.value.indexOf(HOT_TAGS.SPACE)) {
        this.selectedTags$.next([HOT_TAGS.SPACE]);
      } else if (this.selectedTags$.value.indexOf(HOT_TAGS.SPACE) === -1) {
        this.selectedTags$.next([HOT_TAGS.ALL]);
      }
    });

    this.categoryControl.valueChanges.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj && obj !== AddedCategories.ALL && this.selectedTags$.value.indexOf(HOT_TAGS.CATEGORY)) {
        this.selectedTags$.next([HOT_TAGS.CATEGORY]);
      } else if (this.selectedTags$.value.indexOf(HOT_TAGS.CATEGORY) === -1) {
        this.selectedTags$.next([HOT_TAGS.ALL]);
      }
    });
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public getHandler(last?: any, search?: string): Observable<Collection[]> {
    if (this.filter.selectedSort$.value === SortOptions.PRICE_LOW) {
      if (this.selectedTags$.value[0] === HOT_TAGS.OPEN_SALE_ONLY) {
        return this.collectionApi.lowToHighAccess(CollectionAccess.OPEN, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.MEMBERS_ONLY) {
        return this.collectionApi.lowToHighAccess(CollectionAccess.MEMBERS_ONLY, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.SPACE) {
        return this.collectionApi.lowToHighSpace(this.spaceControl.value, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.CATEGORY) {
        return this.collectionApi.lowToHighCategory(this.categoryControl.value, last, search);
      } else {
        return this.collectionApi.lowToHigh(last, search);
      }
    } else if (this.filter.selectedSort$.value === SortOptions.RECENT) {
      if (this.selectedTags$.value[0] === HOT_TAGS.OPEN_SALE_ONLY) {
        return this.collectionApi.topAccess(CollectionAccess.OPEN, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.MEMBERS_ONLY) {
        return this.collectionApi.topAccess(CollectionAccess.MEMBERS_ONLY, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.SPACE) {
        return this.collectionApi.topSpace(this.spaceControl.value, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.CATEGORY) {
        return this.collectionApi.topCategory(this.categoryControl.value, last, search);
      } else {
        return this.collectionApi.top(last, search);
      }
    } else {
      if (this.selectedTags$.value[0] === HOT_TAGS.OPEN_SALE_ONLY) {
        return this.collectionApi.highToLowAccess(CollectionAccess.OPEN, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.MEMBERS_ONLY) {
        return this.collectionApi.highToLowAccess(CollectionAccess.MEMBERS_ONLY, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.SPACE) {
        return this.collectionApi.highToLowSpace(this.spaceControl.value, last, search);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.CATEGORY) {
        return this.collectionApi.highToLowCategory(this.categoryControl.value, last, search);
      } else {
        return this.collectionApi.highToLow(last, search);
      }
    }
  }

  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || []).map((o) => ({
        label: o.name || o.uid,
        value: o.uid,
        img: o.avatarUrl
    }));
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.collections$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    this.subscriptions$.push(this.getHandler(this.collections$.value[this.collections$.value.length - 1]._doc).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
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
    this.collections$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.collections$.pipe(map(() => {
      if (!this.dataStore[this.dataStore.length - 1]) {
        return true;
      }

      return (!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE);
    }));
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.dataStore = [];
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
    this.collections$.next(undefined);
  }
}
