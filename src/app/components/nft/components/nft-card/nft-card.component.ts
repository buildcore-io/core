import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AuthService } from '@components/auth/services/auth.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { getItem, StorageItem } from '@core/utils';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { UnitsHelper } from '@core/utils/units-helper';
import { Collection } from 'functions/interfaces/models';
import { Nft } from 'functions/interfaces/models/nft';
import { NzNotificationService } from 'ng-zorro-antd/notification';

@Component({
  selector: 'wen-nft-card',
  templateUrl: './nft-card.component.html',
  styleUrls: ['./nft-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NftCardComponent {
  @Input() fullWidth?: boolean;
  @Input() nft?: Nft|null;
  @Input() collection?: Collection|null;
  @Input() isOwned = false;

  public isCheckoutOpen = false;
  public path = ROUTER_UTILS.config.nft.root;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    private auth: AuthService,
    private nzNotification: NzNotificationService
  ) {}

  public onBuy(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (getItem(StorageItem.CheckoutTransaction)) {
      this.nzNotification.error('You currently have open order. Pay for it or let it expire.', '');
      return;
    }
    this.isCheckoutOpen = true;
  }

  private discount(): number {
    if (!this.collection?.space || !this.auth.member$.value?.spaces?.[this.collection.space]?.totalReputation) {
      return 1;
    }
    const xp: number = this.auth.member$.value.spaces[this.collection.space].totalReputation || 0;
    let discount = 1;
    if (xp > 0) {
      for (const d of this.collection.discounts) {
        if (d.xp < xp) {
          discount = (1 - d.amount);
        }
      }
    }

    return discount;
  }

  public applyDiscount(amount?: number | null): number {
    return Math.ceil((amount || 0) * this.discount());
  }

  public formatBest(amount?: number|null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }
}
