import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { CollectionApi } from '@api/collection.api';
import { MemberApi } from '@api/member.api';
import { NftApi } from '@api/nft.api';
import { SpaceApi } from '@api/space.api';
import { AuthService } from '@components/auth/services/auth.service';
import { AvatarService } from '@core/services/avatar';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HOT_TAGS } from '@pages/market/pages/nfts/nfts.page';
import { FilterService } from '@pages/market/services/filter.service';
import * as dayjs from 'dayjs';
import { WEN_NAME } from 'functions/interfaces/config';
import { Collection } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';
import { Nft } from 'functions/interfaces/models/nft';
import { BehaviorSubject, first, map, Observable, skip, Subscription } from 'rxjs';
import { DataService } from '../../services/data.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';

@UntilDestroy()
@Component({
  selector: 'wen-collection',
  templateUrl: './collection.page.html',
  styleUrls: ['./collection.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionPage implements OnInit, OnDestroy {
  public isAboutCollectionVisible = false;
  public sortControl: FormControl;
  public filterControl: FormControl;
  public hotTags: string[] = [HOT_TAGS.ALL, HOT_TAGS.AVAILABLE, HOT_TAGS.SOLD];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);
  private guardiansSubscription$?: Subscription;
  private subscriptions$: Subscription[] = [];

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public data: DataService,
    public avatarService: AvatarService,
    private auth: AuthService,
    private notification: NotificationService,
    private spaceApi: SpaceApi,
    private memberApi: MemberApi,
    private collectionApi: CollectionApi,
    private nftApi: NftApi,
    private titleService: Title,
    private route: ActivatedRoute,
    private router: Router

  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.filterControl = new FormControl('');
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'Collection');
    this.route.params.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.collection.collection.replace(':', '')];
      if (id) {
        this.listenToCollection(id);
      } else {
        this.notFound();
      }
    });

    this.data.collection$.pipe(skip(1), untilDestroyed(this)).subscribe((obj: Collection|undefined) => {
      if (!obj) {
        this.notFound();
        return;
      }

      // Once we load proposal let's load guardians for the space.
      if (this.guardiansSubscription$) {
        this.guardiansSubscription$.unsubscribe();
      }

      if (this.auth.member$.value?.uid) {
        this.guardiansSubscription$ = this.spaceApi.isGuardianWithinSpace(obj.space, this.auth.member$.value.uid)
                                      .pipe(untilDestroyed(this)).subscribe(this.data.isGuardianWithinSpace$);
      }
    });

    this.data.collection$.pipe(skip(1), first()).subscribe(async (p) => {
      if (p) {
        this.subscriptions$.push(this.spaceApi.listen(p.space).pipe(untilDestroyed(this)).subscribe(this.data.space$));
        if (p.createdBy) {
          this.subscriptions$.push(this.memberApi.listen(p.createdBy).pipe(untilDestroyed(this)).subscribe(this.data.creator$));
        }
      }
    });
  }

  public createNft(): void {
    this.router.navigate([
      ('/' + ROUTER_UTILS.config.nft.root),
      ROUTER_UTILS.config.nft.newNft,
      { collection: this.data.collectionId }
    ]);
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  private listenToCollection(id: string): void {
    this.data.collectionId = id;
    this.cancelSubscriptions();
    this.subscriptions$.push(this.collectionApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.data.collection$));
    this.subscriptions$.push(this.getHandler(id).subscribe(this.data.nft$));
    this.subscriptions$.push(
      this.nftApi.lowToHighInCollection(id, undefined, undefined, 1).pipe(untilDestroyed(this), map((obj: Nft[]) => {
        return obj[0];
      })).subscribe(this.data.cheapestNft$)
    );
  }

  public formatBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }

  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public async approve(): Promise<void> {
    if (!this.data.collection$.value?.uid) {
      return;
    }

    await this.auth.sign({
        uid: this.data.collection$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(this.collectionApi.approve(sc), 'Approved.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }

  public async reject(): Promise<void> {
    if (!this.data.collection$.value?.uid) {
      return;
    }

    await this.auth.sign({
      uid: this.data.collection$.value.uid
    }, (sc, finish) => {
      this.notification.processRequest(this.collectionApi.reject(sc), 'Rejected.', finish).subscribe((val: any) => {
        // none.
      });
    });
  }

  public edit(): void {
    if (!this.data.space$.value?.uid) {
      return;
    }

    this.router.navigate([ROUTER_UTILS.config.collection.root, ROUTER_UTILS.config.collection.edit, {
      collectionId: this.data.collection$.value?.uid
    }]);
  }

  public getHandler(collectionId: string, last?: any, search?: string): Observable<Nft[]> {
    return this.nftApi.positionInCollection(collectionId, last, search).pipe(untilDestroyed(this));
  }

  protected store(page: number, a: any): void {
    if (this.data.dataStore[page]) {
      this.data.dataStore[page] = a;
    } else {
      this.data.dataStore.push(a);
    }

    // Merge arrays.
    this.data.nft$.next(Array.prototype.concat.apply([], this.data.dataStore));
  }

  public isAvailableForSale(col?: Collection|null): boolean {
    if (!col) {
      return false;
    }

    return ((col.total - col.sold) > 0) && col.approved === true && dayjs(col.availableFrom.toDate()).isBefore(dayjs());
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.data.nft$.value || !this.data.collection$.value) {
      return;
    }

    // We reached maximum.
    if ((!this.data.dataStore[this.data.dataStore.length - 1] || this.data.dataStore[this.data.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE)) {
      return;
    }

    this.subscriptions$.push(this.getHandler(this.data.collection$.value.uid, this.data.nft$.value[this.data.nft$.value.length - 1].createdOn).subscribe(this.store.bind(this, this.data.dataStore.length)));
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.data.nft$.pipe(map(() => {
      if (!this.data.dataStore[this.data.dataStore.length - 1]) {
        return true;
      }

      return (!this.data.dataStore[this.data.dataStore.length - 1] || this.data.dataStore[this.data.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE);
    }));
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
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
    this.titleService.setTitle(WEN_NAME);
    this.cancelSubscriptions();
    this.guardiansSubscription$?.unsubscribe();
  }
}
