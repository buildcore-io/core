import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionApi } from '@api/collection.api';
import { MemberApi } from '@api/member.api';
import { NftApi } from '@api/nft.api';
import { SpaceApi } from '@api/space.api';
import { AvatarService } from '@core/services/avatar';
import { getItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { copyToClipboard } from '@core/utils/tools.utils';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { WEN_NAME } from 'functions/interfaces/config';
import { Collection, CollectionType } from 'functions/interfaces/models';
import { FILE_SIZES, Timestamp } from 'functions/interfaces/models/base';
import { Nft } from 'functions/interfaces/models/nft';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first, map, skip, Subscription } from 'rxjs';
import { DataService } from '../../services/data.service';

@UntilDestroy()
@Component({
  selector: 'wen-nft',
  templateUrl: './nft.page.html',
  styleUrls: ['./nft.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NFTPage implements OnInit, OnDestroy {
  public collectionPath: string = ROUTER_UTILS.config.collection.root;
  public isCheckoutOpen = false;
  private subscriptions$: Subscription[] = [];
  constructor(
    public data: DataService,
    public avatarService: AvatarService,
    private titleService: Title,
    private route: ActivatedRoute,
    private spaceApi: SpaceApi,
    private memberApi: MemberApi,
    private nzNotification: NzNotificationService,
    private collectionApi: CollectionApi,
    private nftApi: NftApi,
    private router: Router
  ) {
    // none
  }

  public ngOnInit(): void {
    this.titleService.setTitle(WEN_NAME + ' - ' + 'NFT');
    this.route.params.pipe(untilDestroyed(this)).subscribe((obj) => {
      const id: string|undefined = obj?.[ROUTER_UTILS.config.nft.nft.replace(':', '')];
      if (id) {
        this.listenToNft(id);
      } else {
        this.notFound();
      }
    });

    this.data.nft$.pipe(skip(1), untilDestroyed(this)).subscribe((obj: Nft|undefined) => {
      if (!obj) {
        this.notFound();
        return;
      }
    });

    this.data.nft$.pipe(skip(1), first()).subscribe(async (p) => {
      if (p) {
        this.subscriptions$.push(this.spaceApi.listen(p.space).pipe(untilDestroyed(this)).subscribe(this.data.space$));
        this.subscriptions$.push(this.collectionApi.listen(p.collection).pipe(untilDestroyed(this)).subscribe(this.data.collection$));
        this.subscriptions$.push(this.nftApi.successfullOrders(p.uid).pipe(untilDestroyed(this)).subscribe(this.data.orders$));
        this.subscriptions$.push(this.nftApi.positionInCollection(p.collection, undefined, undefined, 5).pipe(untilDestroyed(this)).subscribe(this.data.topNftWithinCollection$));
        if (p.createdBy) {
          this.subscriptions$.push(this.memberApi.listen(p.createdBy).pipe(untilDestroyed(this)).subscribe(this.data.creator$));
        }
        if (p.owner) {
          this.subscriptions$.push(this.memberApi.listen(p.owner).pipe(untilDestroyed(this)).subscribe(this.data.owner$));
        }
        this.subscriptions$.push(
          this.nftApi.lastCollection(p.collection, undefined, undefined, 1).pipe(untilDestroyed(this), map((obj: Nft[]) => {
            return obj[0];
          })).subscribe(this.data.firstNftInCollection$)
        );
      }
    });

    this.data.collection$.pipe(skip(1), first()).subscribe(async (p) => {
      if (p) {
        this.subscriptions$.push(this.spaceApi.listen(p.royaltiesSpace).pipe(untilDestroyed(this)).subscribe(this.data.royaltySpace$));
        if (p.createdBy) {
          this.subscriptions$.push(this.memberApi.listen(p.createdBy).pipe(untilDestroyed(this)).subscribe(this.data.collectionCreator$));
        }
      }
    });
  }

  private listenToNft(id: string): void {
    this.data.nftId = id;
    this.cancelSubscriptions();
    this.subscriptions$.push(this.nftApi.listen(id).pipe(untilDestroyed(this)).subscribe(this.data.nft$));
  }

  public isAvailableForSale(nft?: Nft|null, col?: Collection|null): boolean {
    if (!col) {
      return false;
    }

    return ((col.total - col.sold) > 0) && col.approved === true && dayjs(col.availableFrom.toDate()).isBefore(dayjs()) && !nft?.owner;
  }

  public buy(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (getItem(StorageItem.CheckoutTransaction)) {
      this.nzNotification.error('You currently have open order. Pay for it or let it expire.', '');
      return;
    }
    this.isCheckoutOpen = true;
  }

  public copy(): void {
    copyToClipboard(window.location.href);
  }

  public isLoading(arr: any): boolean {
    return arr === undefined;
  }

  public isEmpty(arr: any): boolean {
    return (Array.isArray(arr) && arr.length === 0);
  }

  public getShareUrl(): string {
    return 'http://twitter.com/share?text=Check out collection&url=' + window.location.href + '&hashtags=soonaverse';
  }

  private notFound(): void {
    this.router.navigate([ROUTER_UTILS.config.errorResponse.notFound]);
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public isDateInFuture(date?: Timestamp|null): boolean {
    if (!date) {
      return false;
    }

    return dayjs(date.toDate()).isBefore(dayjs());
  }

  public getTitle(nft?: Nft|null): any {
    if (!nft) {
      return '';
    }

    if (!nft.owner) {
      if (nft.type === CollectionType.CLASSIC) {
        return nft.name;
      } else if (nft.type === CollectionType.GENERATED) {
        return 'Generated NFT';
      } else if (nft.type === CollectionType.SFT) {
        return 'SFT';
      }
    } else {
      return nft.name;
    }
  }

  public generatedNft(nft?: Nft|null): boolean {
    if (!nft) {
      return false;
    }

    return (!nft.owner && (nft.type === CollectionType.GENERATED || nft.type === CollectionType.SFT));
  }

  private cancelSubscriptions(): void {
    this.subscriptions$.forEach((s) => {
      s.unsubscribe();
    });
  }

  public ngOnDestroy(): void {
    this.titleService.setTitle(WEN_NAME);
    this.cancelSubscriptions();
  }
}
