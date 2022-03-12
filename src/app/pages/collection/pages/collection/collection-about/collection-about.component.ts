import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { CollectionAccess, DiscountLine } from '@functions/interfaces/models';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'wen-collection-about',
  templateUrl: './collection-about.component.html',
  styleUrls: ['./collection-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionAboutComponent {
  constructor(
    public data: DataService,
    public deviceService: DeviceService
  ) {
    // none.
  }

  public get access(): typeof CollectionAccess {
    return CollectionAccess;
  }

  public getAccessLabel(access?: CollectionAccess|null): string {
    if (!access) {
      return '';
    }

    if (access === CollectionAccess.GUARDIANS_ONLY) {
      return $localize`Guardians of Space Only`;
    } else if (access === CollectionAccess.MEMBERS_ONLY) {
      return $localize`Members of Space Only`;
    } else if (access === CollectionAccess.MEMBERS_WITH_BADGE) {
      return $localize`Members With Badge Only`;
    } else {
      return '';
    }
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public sortedDiscounts(discounts?: DiscountLine[]|null): DiscountLine[] {
    if (!discounts?.length) {
      return [];
    }

    return discounts.sort((a, b) => {
      return a.xp - b.xp;
    });
  }

  public getShareUrl(): string {
    const text = $localize`Check out collection`;
    return 'http://twitter.com/share?text= ' + text + ' &url=' + window.location.href + '&hashtags=soonaverse';
  }
}
