import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { FileApi } from '@api/file.api';
import { MemberApi } from '@api/member.api';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { MIN_AMOUNT_TO_TRANSFER } from '@functions/interfaces/config';
import { Collection, CollectionAccess, CollectionType, Member } from '@functions/interfaces/models';
import { FILE_SIZES, Timestamp } from '@functions/interfaces/models/base';
import { Nft } from '@functions/interfaces/models/nft';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as dayjs from 'dayjs';
import { BehaviorSubject, Subscription, take } from 'rxjs';

@UntilDestroy()
@Component({
  selector: 'wen-nft-card',
  templateUrl: './nft-card.component.html',
  styleUrls: ['./nft-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftCardComponent {
  @Input() fullWidth?: boolean;
  @Input()
  set nft(value: Nft|null|undefined) {
    if (this.memberApiSubscription) {
      this.memberApiSubscription.unsubscribe();
    }
    this._nft = value;
    if (this.nft?.owner) {
      this.memberApiSubscription = this.memberApi.listen(this.nft.owner).pipe(untilDestroyed(this)).subscribe(this.owner$);
    } else {
      this.owner$.next(undefined);
    }

    if (this._nft) {
      this.fileApi.getMetadata(this._nft.media).pipe(take(1), untilDestroyed(this)).subscribe((o) => {
        if (o.contentType.match('video/.*')) {
          this.mediaType = 'video';
        } else if (o.contentType.match('image/.*')) {
          this.mediaType = 'image';
        }

        this.cd.markForCheck();
      });
    }
  }
  get nft(): Nft|null|undefined {
    return this._nft;
  }
  @Input() collection?: Collection|null;

  public mediaType: 'video'|'image'|undefined;
  public isCheckoutOpen = false;
  public isBidOpen = false;
  public path = ROUTER_UTILS.config.nft.root;
  public owner$: BehaviorSubject<Member|undefined> = new BehaviorSubject<Member|undefined>(undefined);
  private memberApiSubscription?: Subscription;
  private _nft?: Nft|null;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    private auth: AuthService,
    private cd: ChangeDetectorRef,
    private router: Router,
    private memberApi: MemberApi,
    private fileApi: FileApi
  ) {}

  public onBuy(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.router.navigate(['/', ROUTER_UTILS.config.nft.root, this.nft?.uid, { b: 't' }])
  }

  public onImgErrorWeShowPlaceHolderVideo(event: any): any {
    // Try full image instead.
    event.target.src = '/assets/mocks/video_placeholder.jpg';
  }

  public isAvailableForSale(): boolean {
    if (!this.collection) {
      return false;
    }

    return ((this.collection.total - this.collection.sold) > 0) && this.collection.approved === true &&
            !!this.nft?.availableFrom && dayjs(this.nft.availableFrom.toDate()).isBefore(dayjs()) && !this.nft?.owner;
  }

  private discount(): number {
    if (!this.collection?.space || !this.auth.member$.value?.spaces?.[this.collection.space]?.totalReputation || this._nft?.owner) {
      return 1;
    }
    const xp: number = this.auth.member$.value.spaces[this.collection.space].totalReputation || 0;
    let discount = 1;
    if (xp > 0) {
      for (const d of this.collection.discounts.sort((a, b) => {
        return a.xp - b.xp;
      })) {
        if (d.xp < xp) {
          discount = (1 - d.amount);
        }
      }
    }

    return discount;
  }

  public applyDiscount(amount?: number | null): number {
    let finalPrice = Math.ceil((amount || 0) * this.discount());
    if (finalPrice < MIN_AMOUNT_TO_TRANSFER) {
      finalPrice = MIN_AMOUNT_TO_TRANSFER;
    }

    return finalPrice;
  }

  public formatBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public get targetAccess(): typeof CollectionAccess {
    return CollectionAccess;
  }

  public getBadgeProperties(): { label: string; className: string} {
    if (this.nft?.type === CollectionType.CLASSIC) {
      return {
        label: $localize`New NFT`,
        className: 'bg-tag-green'
      };
    } else {
      const remaining = ((this.collection?.total || 0) - (this.collection?.sold || 0));
      return {
        label: remaining > 100 ? `100+ remaining` : `${remaining} remaining`,
        className: remaining >= 100 ? 'bg-tag-blue' : 'bg-tag-red'
      };
    }
  }

  public isDateInFuture(date?: Timestamp|null): boolean {
    if (!date) {
      return false;
    }

    return dayjs(date.toDate()).isAfter(dayjs(), 's');
  }

  public getDaysLeft(availableFrom?: Timestamp): number {
    if (!availableFrom) return 0;
    return dayjs(availableFrom.toDate()).diff(dayjs(new Date()), 'day');
  }
}
