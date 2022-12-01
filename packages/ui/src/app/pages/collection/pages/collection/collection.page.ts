import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AwardApi } from '@api/award.api';
import { DEFAULT_LIST_SIZE } from '@api/base.api';
import { CollectionApi } from '@api/collection.api';
import { MemberApi } from '@api/member.api';
import { NftApi } from '@api/nft.api';
import { SpaceApi } from '@api/space.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { SeoService } from '@core/services/seo';
import { UnitsService } from '@core/services/units';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { environment } from '@env/environment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HOT_TAGS } from '@pages/collection/pages/collection/nfts/nfts.page';
import { HelperService } from '@pages/collection/services/helper.service';
import { FilterService } from '@pages/market/services/filter.service';
import { SortOptions } from '@pages/market/services/sort-options.interface';
import {
  Award,
  COL,
  Collection,
  CollectionType,
  FILE_SIZES,
  GLOBAL_DEBOUNCE_TIME,
  Network,
  Nft,
  RANKING,
  RANKING_TEST,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import {
  BehaviorSubject,
  debounceTime,
  first,
  firstValueFrom,
  map,
  Observable,
  skip,
  Subscription,
} from 'rxjs';
import { DataService } from '../../services/data.service';
import { NotificationService } from './../../../../@core/services/notification/notification.service';

@UntilDestroy()
@Component({
  selector: 'wen-collection',
  templateUrl: './collection.page.html',
  styleUrls: ['./collection.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPage implements OnInit, OnDestroy {
  public isAboutCollectionVisible = false;
  public seeMore = false;
  public sortControl: FormControl;
  public filterControl: FormControl;
  public hotTags: string[] = [
    HOT_TAGS.ALL,
    HOT_TAGS.PENDING,
    HOT_TAGS.AVAILABLE,
    HOT_TAGS.AUCTION,
    HOT_TAGS.OWNED,
  ];
  public selectedTags$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([HOT_TAGS.ALL]);
  public rankingConfig = environment.production === true ? RANKING : RANKING_TEST;
  private guardiansSubscription$?: Subscription;
  private guardiansRankModeratorSubscription$?: Subscription;
  private subscriptions$: Subscription[] = [];

  constructor(
    public filter: FilterService,
    public deviceService: DeviceService,
    public data: DataService,
    public helper: HelperService,
    public previewImageService: PreviewImageService,
    public auth: AuthService,
    public unitsService: UnitsService,
    private notification: NotificationService,
    private nzNotification: NzNotificationService,
    private spaceApi: SpaceApi,
    private awardApi: AwardApi,
    private memberApi: MemberApi,
    private collectionApi: CollectionApi,
    private nftApi: NftApi,
    private cd: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private seo: SeoService,
  ) {
    this.sortControl = new FormControl(this.filter.selectedSort$.value);
    this.filterControl = new FormControl(undefined);
  }

  public ngOnInit(): void {
    this.deviceService.viewWithSearch$.next(true);
    this.route.params?.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string | undefined =
        obj?.[ROUTER_UTILS.config.collection.collection.replace(':', '')];
      if (id) {
        this.listenToCollection(id);
      } else {
        this.notFound();
      }
    });

    this.auth.member$.pipe(untilDestroyed(this)).subscribe(() => {
      // Once we load proposal let's load guardians for the space.
      if (this.guardiansRankModeratorSubscription$) {
        this.guardiansRankModeratorSubscription$.unsubscribe();
      }

      if (this.auth.member$.value?.uid) {
        this.guardiansRankModeratorSubscription$ = this.spaceApi
          .isGuardianWithinSpace(this.rankingConfig.collectionSpace, this.auth.member$.value.uid)
          .pipe(untilDestroyed(this))
          .subscribe((v) => {
            this.data.isGuardianInRankModeratorSpace$.next(v);
          });
      }
    });

    this.data.collection$
      .pipe(skip(1), untilDestroyed(this))
      .subscribe(async (obj: Collection | undefined) => {
        if (!obj) {
          this.notFound();
          return;
        }

        this.seo.setTags('Collection - ' + obj.name, obj.description, obj.bannerUrl);

        // Once we load proposal let's load guardians for the space.
        if (this.guardiansSubscription$) {
          this.guardiansSubscription$.unsubscribe();
        }

        if (this.auth.member$.value?.uid) {
          this.guardiansSubscription$ = this.spaceApi
            .isGuardianWithinSpace(obj.space, this.auth.member$.value.uid)
            .pipe(untilDestroyed(this))
            .subscribe(this.data.isGuardianWithinSpace$);
        }

        // Get badges to show.
        const awards: Award[] = [];
        if (obj.accessAwards?.length) {
          for (const a of obj.accessAwards) {
            const award: Award | undefined = await firstValueFrom(this.awardApi.listen(a));
            if (award) {
              awards.push(award);
            }
          }
        }

        this.data.accessBadges$.next(awards);
        if (obj.accessCollections?.length) {
          this.data.accessCollections$.next(obj.accessCollections);
        }
      });

    this.data.collection$.pipe(skip(1), first()).subscribe(async (p) => {
      if (p) {
        this.subscriptions$.push(
          this.spaceApi.listen(p.space).pipe(untilDestroyed(this)).subscribe(this.data.space$),
        );
        if (p.royaltiesSpace) {
          this.subscriptions$.push(
            this.spaceApi
              .listen(p.royaltiesSpace)
              .pipe(untilDestroyed(this))
              .subscribe(this.data.royaltySpace$),
          );
        }
        if (p.createdBy) {
          this.subscriptions$.push(
            this.memberApi
              .listen(p.createdBy)
              .pipe(untilDestroyed(this))
              .subscribe(this.data.creator$),
          );
        }
      }
    });

    this.selectedTags$.pipe(untilDestroyed(this)).subscribe(() => {
      if (this.data.collectionId) {
        this.listenToCollection(this.data.collectionId);
      }
    });

    this.filter.selectedSort$.pipe(skip(1), untilDestroyed(this)).subscribe(() => {
      if (this.data.collectionId) {
        this.listenToCollection(this.data.collectionId);
      }
    });

    this.filter.search$.pipe(skip(1), untilDestroyed(this)).subscribe(() => {
      if (this.data.collectionId) {
        this.listenToCollection(this.data.collectionId);
      }
    });

    this.sortControl.valueChanges.pipe(untilDestroyed(this)).subscribe((o) => {
      this.filter.selectedSort$.next(o);
    });

    this.filterControl.setValue(this.filter.search$.value);
    this.filterControl.valueChanges
      .pipe(debounceTime(GLOBAL_DEBOUNCE_TIME), untilDestroyed(this))
      .subscribe(this.filter.search$);
  }

  public createNft(): void {
    this.router.navigate([
      '/' + ROUTER_UTILS.config.nft.root,
      ROUTER_UTILS.config.nft.newNft,
      { collection: this.data.collectionId },
    ]);
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  private listenToCollection(id: string): void {
    this.cancelSubscriptions();
    this.data.collectionId = id;
    this.subscriptions$.push(
      this.collectionApi.listen(id)?.pipe(untilDestroyed(this)).subscribe(this.data.collection$),
    );
    this.subscriptions$.push(
      this.getHandler(id, undefined).subscribe(this.store.bind(this, this.data.dataStore.length)),
    );

    this.subscriptions$.push(this.collectionApi.stats(id).subscribe(this.data.collectionStats$));

    this.subscriptions$.push(
      this.nftApi
        .lowToHighCollection(id, undefined, 1)
        ?.pipe(
          untilDestroyed(this),
          map((obj: Nft[]) => {
            return obj[0];
          }),
        )
        .subscribe(this.data.cheapestNft$),
    );
    this.subscriptions$.push(
      this.nftApi
        .lastCollection(id, undefined, 1)
        ?.pipe(
          untilDestroyed(this),
          map((obj: Nft[]) => {
            if (
              obj[0] &&
              this.isAvailableTab() &&
              (obj[0]?.availableFrom === null ||
                !dayjs(obj[0].availableFrom.toDate()).isBefore(dayjs()) ||
                obj[0].owner)
            ) {
              return undefined;
            } else if (this.isOwnedTab()) {
              return undefined;
            } else {
              return obj[0];
            }
          }),
        )
        .subscribe(this.data.firstNft$),
    );
  }

  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public get collectionTypes(): typeof CollectionType {
    return CollectionType;
  }

  public async approve(): Promise<void> {
    if (!this.data.collection$.value?.uid) {
      return;
    }

    await this.auth.sign(
      {
        uid: this.data.collection$.value.uid,
      },
      (sc, finish) => {
        this.notification
          .processRequest(this.collectionApi.approve(sc), 'Approved.', finish)
          .subscribe(() => {
            // none.
          });
      },
    );
  }

  public async reject(): Promise<void> {
    if (!this.data.collection$.value?.uid) {
      return;
    }

    await this.auth.sign(
      {
        uid: this.data.collection$.value.uid,
      },
      (sc, finish) => {
        this.notification
          .processRequest(this.collectionApi.reject(sc), 'Rejected.', finish)
          .subscribe(() => {
            // none.
          });
      },
    );
  }

  public edit(): void {
    if (!this.data.space$.value?.uid) {
      return;
    }

    this.router.navigate([
      ROUTER_UTILS.config.collection.root,
      ROUTER_UTILS.config.collection.edit,
      {
        collectionId: this.data.collection$.value?.uid,
      },
    ]);
  }

  public getHandler(collectionId: string, last?: any): Observable<Nft[]> {
    if (this.filter.selectedSort$.value === SortOptions.PRICE_LOW) {
      if (this.selectedTags$.value[0] === HOT_TAGS.AVAILABLE) {
        return this.nftApi.lowToHighAvailableCollection(collectionId, last);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.AUCTION) {
        return this.nftApi.lowToHighAuctionCollection(collectionId, last);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.PENDING) {
        return this.nftApi.lowToHighPendingCollection(collectionId, last);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.OWNED) {
        return this.nftApi.lowToHighOwnedCollection(collectionId, last);
      } else {
        return this.nftApi.lowToHighCollection(collectionId, last);
      }
    } else if (this.filter.selectedSort$.value === SortOptions.RECENT) {
      if (this.selectedTags$.value[0] === HOT_TAGS.AVAILABLE) {
        return this.nftApi.topAvailableCollection(collectionId, last);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.AUCTION) {
        return this.nftApi.topAuctionCollection(collectionId, last);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.PENDING) {
        return this.nftApi.topPendingCollection(collectionId, last);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.OWNED) {
        return this.nftApi.topOwnedCollection(collectionId, last);
      } else {
        return this.nftApi.topCollection(collectionId, last);
      }
    } else {
      if (this.selectedTags$.value[0] === HOT_TAGS.AVAILABLE) {
        return this.nftApi.highToLowAvailableCollection(collectionId, last);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.AUCTION) {
        return this.nftApi.highToLowAuctionCollection(collectionId, last);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.PENDING) {
        return this.nftApi.highToLowPendingCollection(collectionId, last);
      } else if (this.selectedTags$.value[0] === HOT_TAGS.OWNED) {
        return this.nftApi.highToLowOwnedCollection(collectionId, last);
      } else {
        return this.nftApi.highToLowCollection(collectionId, last);
      }
    }
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

  public isAvailableTab(): boolean {
    return this.selectedTags$.value.indexOf(HOT_TAGS.AVAILABLE) > -1;
  }

  public isOwnedTab(): boolean {
    return this.selectedTags$.value.indexOf(HOT_TAGS.OWNED) > -1;
  }

  public onScroll(): void {
    // In this case there is no value, no need to infinite scroll.
    if (!this.data.nft$.value || !this.data.collection$.value) {
      return;
    }

    // We reached maximum.
    if (
      !this.data.dataStore[this.data.dataStore.length - 1] ||
      this.data.dataStore[this.data.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE
    ) {
      return;
    }

    this.subscriptions$.push(
      this.getHandler(
        this.data.collection$.value.uid,
        this.data.nft$.value[this.data.nft$.value.length - 1]._doc,
      ).subscribe(this.store.bind(this, this.data.dataStore.length)),
    );
  }

  public get maxRecords$(): BehaviorSubject<boolean> {
    return <BehaviorSubject<boolean>>this.data.nft$.pipe(
      map(() => {
        if (!this.data.dataStore[this.data.dataStore.length - 1]) {
          return true;
        }

        return (
          !this.data.dataStore[this.data.dataStore.length - 1] ||
          this.data.dataStore[this.data.dataStore.length - 1]?.length < DEFAULT_LIST_SIZE
        );
      }),
    );
  }

  public async vote(direction: -1 | 0 | 1): Promise<void> {
    if (!this.data.collection$?.value?.uid) {
      return;
    }

    await this.auth.sign(
      { collection: COL.COLLECTION, uid: this.data.collection$.value.uid, direction },
      (sc, finish) => {
        this.notification
          .processRequest(this.collectionApi.vote(sc), 'Voted', finish)
          .subscribe(() => {
            // none.
          });
      },
    );
  }

  public async rank(): Promise<void> {
    if (!this.data.collection$?.value?.uid) {
      return;
    }

    const rankUnparsed: string | null = prompt('Press a button!\nEither OK or Cancel.');
    if (!rankUnparsed) {
      return;
    }

    const rank = parseInt(rankUnparsed);
    if (!(rank >= this.rankingConfig.MIN_RANK && rank <= this.rankingConfig.MAX_RANK)) {
      this.nzNotification.error(
        $localize`Rank amount must be between ` +
          this.rankingConfig.MIN_RANK +
          ' -> ' +
          this.rankingConfig.MAX_RANK,
        '',
      );
      return;
    }

    await this.auth.sign(
      { collection: COL.COLLECTION, uid: this.data.collection$.value.uid, rank },
      (sc, finish) => {
        this.notification
          .processRequest(this.collectionApi.rank(sc), 'Ranked', finish)
          .subscribe(() => {
            // none.
          });
      },
    );
  }

  public getTotalNfts(nft?: Nft[] | null, collection?: Collection | null): number {
    // ((data.nft$ | async)?.length || 0)
    if (!collection || !nft) {
      return 0;
    }

    if (collection.type === CollectionType.CLASSIC || this.isOwnedTab()) {
      return nft.length;
    } else {
      let total: number = nft.length + (collection.total - collection.sold);
      if (this.data.firstNft$.value && collection.total - collection.sold > 0) {
        total = total - 1;
      }

      return total;
    }
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return Array.isArray(arr) && arr.length === 0;
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });

    this.data.reset();
  }

  public ngOnDestroy(): void {
    this.cancelSubscriptions();
    this.guardiansSubscription$?.unsubscribe();
  }

  public get networkTypes(): typeof Network {
    return Network;
  }

  public collapseInfo() {
    this.seeMore = !this.seeMore;
    this.cd.markForCheck();
  }
}
