import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { MemberApi } from '@api/member.api';
import { SpaceApi } from '@api/space.api';
import { AuthService } from '@components/auth/services/auth.service';
import { AvatarService } from '@core/services/avatar';
import { DeviceService } from '@core/services/device';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { HOT_TAGS } from '@pages/market/pages/nfts/nfts.page';
import { FilterService } from '@pages/market/services/filter.service';
import { WEN_NAME } from 'functions/interfaces/config';
import { Collection } from 'functions/interfaces/models';
import { Nft } from 'functions/interfaces/models/nft';
import { BehaviorSubject, first, skip, Subscription } from 'rxjs';
import { DataService } from '../../services/data.service';

@UntilDestroy()
@Component({
  selector: 'wen-collection',
  templateUrl: './collection.page.html',
  styleUrls: ['./collection.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionPage implements OnInit, OnDestroy {
  public nft$: BehaviorSubject<Nft[]|undefined> = new BehaviorSubject<Nft[]|undefined>(undefined);
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
    private spaceApi: SpaceApi,
    private memberApi: MemberApi,
    private collectionApi: CollectionApi,
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

    // Once we get proposal get space.
    this.data.collection$.pipe(skip(1), first()).subscribe(async (p) => {
      if (p) {
        this.subscriptions$.push(this.spaceApi.listen(p.space).pipe(untilDestroyed(this)).subscribe(this.data.space$));
        if (p.createdBy) {
          this.subscriptions$.push(this.memberApi.listen(p.createdBy).pipe(untilDestroyed(this)).subscribe(this.data.creator$));
        }
      }
    });
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  private listenToCollection(id: string): void {
    this.data.collectionId = id;
    this.cancelSubscriptions();
    this.subscriptions$.push(this.collectionApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.data.collection$));
  }

  public handleChange(tag: string): void {
    this.selectedTags$.next([tag]);
  }

  public approve(): void {
    // Needs to be implemented
  }

  public reject(): void {
    // Needs to be implemented
  }

  public onScroll(): void {
    // Needs to be implemented
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
