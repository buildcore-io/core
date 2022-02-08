import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { CollectionApi } from '@api/collection.api';
import { SelectSpaceOption } from '@components/select-space/select-space.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { StorageService } from '@core/services/storage';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FilterService } from '@pages/discover/services/filter.service';
import { Space } from 'functions/interfaces/models';
import { Categories, Collection, CollectionType, DiscountLine } from 'functions/interfaces/models/collection';
import { BehaviorSubject, map, Observable, of, skip, Subscription } from 'rxjs';

export enum HOT_TAGS {
  ALL = 'All',
  COLLECTIBLES = 'Collectibles',
  COMMUNITY_DROPS = 'CommunityDrops',
  GENERATED = 'Generated'
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
  public collections$: BehaviorSubject<Collection[]|undefined> = new BehaviorSubject<Collection[]|undefined>(undefined);
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.COLLECTIBLES, HOT_TAGS.COMMUNITY_DROPS, HOT_TAGS.GENERATED];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);
  private dataStore: Collection[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public cache: CacheService,
    public collectionApi: CollectionApi,
    private storageService: StorageService
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.spaceControl = new FormControl(this.storageService.selectedSpace.getValue());
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

  public getSpaceListOptions(list?: Space[] | null): SelectSpaceOption[] {
    return (list || []).map((o) => ({
        label: o.name || o.uid,
        value: o.uid,
        img: o.avatarUrl
    }));
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }
  
  // Needs to be implemented
  public getHandler(last?: any, search?: string): Observable<Collection[]> {
    return of([] as Collection[]);
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

    this.subscriptions$.push(this.getHandler(this.collections$.value[this.collections$.value.length - 1].createdOn).subscribe(this.store.bind(this, this.dataStore.length)));
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
    // this.collections$.next(Array.prototype.concat.apply([], this.dataStore));
    this.collections$.next([
      { uid: '1', name: 'Name is 4 characters long', description: 'dididik', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '2', name: 'Name is 4 characters long1111111111111111123123', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '3', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '4', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '5', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '6', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '7', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '8', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '9', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '10', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '11', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '12', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '13', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '14', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '15', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '16', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '17', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '18', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '19', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '20', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '21', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '22', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '23', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '24', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '25', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '26', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '27', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC },
      { uid: '28', name: 'Name is 4 characters long', description: 'dididikaizxcasddididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasd dididikaizxcasddididikaizxcasddididikaizxcasddididikaizxcasd', bannerUrl: 'https://firebasestorage.googleapis.com/v0/b/soonaverse.appspot.com/o/0x9e3f589b747a0630935b441613be2f71b6c67bba%2Fnuokgorm27r%2Fspace_banner?alt=media&token=0f78e777-9e4e-4131-9957-34e3292eea61', approved: true, rejected: false, twitter: 'asd', url: 'zxc', discord: 'qwe', category: Categories.COLLECTIBLE, discounts: [] as DiscountLine[], total: 123123, royaltiesFee: 123, royaltiesSpace: 'zxcasd', sold: 2, space: 'asd', type: CollectionType.CLASSIC }
    ])
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.collections$.pipe(map(() => {
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