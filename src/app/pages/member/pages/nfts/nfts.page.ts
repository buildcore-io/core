import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { NftApi } from '@api/nft.api';
import { DEFAULT_COLLECTION, SelectCollectionOption } from '@components/collection/components/select-collection/select-collection.component';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { Collection } from '@functions/interfaces/models';
import { Nft } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ParticipantsPage } from '@pages/proposal/pages/participants/participants.page';
import { BehaviorSubject, debounceTime, map, Observable, Subscription } from 'rxjs';
import { DataService } from '../../services/data.service';

@UntilDestroy()
@Component({
  selector: 'wen-nfts',
  templateUrl: './nfts.page.html',
  styleUrls: ['./nfts.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NFTsPage implements OnInit, OnDestroy {
  public collectionControl: FormControl;
  public filterControl: FormControl;
  public nft$: BehaviorSubject<Nft[]|undefined> = new BehaviorSubject<Nft[]|undefined>(undefined);
  private dataStore: Nft[][] = [];
  private subscriptions$: Subscription[] = [];

  constructor(
    public deviceService: DeviceService,
    public cache: CacheService,
    private data: DataService,
    private nftApi: NftApi
  ) {
    this.collectionControl = new FormControl(DEFAULT_COLLECTION.value);
    this.filterControl = new FormControl('');
  }

  public ngOnInit(): void {
    this.filterControl.valueChanges.pipe(untilDestroyed(this), debounceTime(ParticipantsPage.DEBOUNCE_TIME)).subscribe((val: any) => {
      if (val && val.length > 0) {
        this.listen(val);
      } else {
        this.listen();
      }
    });

    this.collectionControl.valueChanges.pipe(untilDestroyed(this)).subscribe(() => {
      this.filterControl.setValue(this.filterControl.value);
    });

    this.data.member$?.pipe(untilDestroyed(this)).subscribe((obj) => {
      if (obj) {
        this.listen();
      }
    })
  }

  private listen(search?: string): void {
    this.cancelSubscriptions();
    this.subscriptions$.push(this.getHandler(undefined, search).subscribe(this.store.bind(this, 0)));
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public getHandler(last?: any, search?: string): Observable<Nft[]> {
    if (this.collectionControl.value !== DEFAULT_COLLECTION.value) {
      return this.nftApi.topMemberByCollection(this.collectionControl.value, this.data.member$.value!.uid, last, search);
    } else {
      return this.nftApi.topMember(this.data.member$.value!.uid, last, search);
    }
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.nft$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    // Def order field.
    const lastValue = this.nft$.value[this.nft$.value.length - 1]._doc;
    this.subscriptions$.push(this.getHandler(lastValue).subscribe(this.store.bind(this, this.dataStore.length)));
  }

  protected store(page: number, a: any): void {
    if (this.dataStore[page]) {
      this.dataStore[page] = a;
    } else {
      this.dataStore.push(a);
    }

    // Merge arrays.
    this.nft$.next(Array.prototype.concat.apply([], this.dataStore));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.nft$.pipe(map(() => {
      if (!this.dataStore[this.dataStore.length - 1]) {
        return true;
      }

      return (!this.dataStore[this.dataStore.length - 1] || this.dataStore[this.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE);
    }));
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public getCollectionListOptions(list?: Collection[] | null): SelectCollectionOption[] {
    return (list || [])
      .filter((o) => o.rejected !== true)
      .map((o) => ({
          label: o.name || o.uid,
          value: o.uid,
          img: o.bannerUrl
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
  }
}
