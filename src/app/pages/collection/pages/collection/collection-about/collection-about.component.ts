import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { enumToArray } from '@core/utils/manipulations.utils';
import { Categories, Collection, DiscountLine } from '@functions/interfaces/models';
import { Access, FILE_SIZES } from '@functions/interfaces/models/base';
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
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService
  ) {
    // none.
  }

  public get access(): typeof Access {
    return Access;
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

  public getAccessLabel(access?: Access | null): string {
    if (!access) {
      return '';
    }

    if (access === Access.GUARDIANS_ONLY) {
      return $localize`Guardians of Space Only`;
    } else if (access === Access.MEMBERS_ONLY) {
      return $localize`Members of Space Only`;
    } else if (access === Access.MEMBERS_WITH_BADGE) {
      return $localize`Members With Badge Only`;
    } else {
      return '';
    }
  }

  public trackByUid(index: number, item: any): number {
    return item.uid;
  }

  public sortedDiscounts(discounts?: DiscountLine[] | null): DiscountLine[] {
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
