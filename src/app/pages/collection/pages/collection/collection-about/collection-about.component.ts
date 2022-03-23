import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { enumToArray } from '@core/utils/manipulations.utils';
import { Categories, Collection, CollectionAccess, DiscountLine } from '@functions/interfaces/models';
import { FILE_SIZES } from '@functions/interfaces/models/base';
import { DataService } from '../../../services/data.service';

@Component({
  selector: 'wen-collection-about',
  templateUrl: './collection-about.component.html',
  styleUrls: ['./collection-about.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionAboutComponent {
  // TODO: remove
  public badge = {
      "fileName": "9234",
      "original": "bafybeic6ai5uirmgtnimdnauafxqllyczculsjhayzoa25udqnfxcosueu",
      "metadata": "QmP4xJSZu95NSX8FYvZFYKusW1eRqHkekFw55KS9xBeFL1",
      "avatar": "bafybeieivvapg72xjl5uoavniztpf5hiyh2iajggcnj7tmk6grzzg7c55e"
  };
  constructor(
    public data: DataService,
    public deviceService: DeviceService
  ) {
    // none.
  }

  public get access(): typeof CollectionAccess {
    return CollectionAccess;
  }

  public get filesizes(): typeof FILE_SIZES {
    return FILE_SIZES;
  }

  public getCategory(category?: Categories): string {
    if (!category) {
      return '';
    }

    const categories = enumToArray(Categories);
    return categories.find(c => c.key === category).value;
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

  public getShareUrl(col?: Collection | null): string {
    const text = $localize`Check out collection`;
    const url: string = (col?.wenUrlShort || col?.wenUrl || window.location.href);
    return 'http://twitter.com/share?text= ' + text + ' &url=' + url + '&hashtags=soonaverse';
  }
}
