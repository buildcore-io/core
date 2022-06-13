import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FileApi } from '@api/file.api';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Space } from '@functions/interfaces/models';
import { Access, FILE_SIZES } from '@functions/interfaces/models/base';
import { Collection } from '@functions/interfaces/models/collection';
import { HelperService } from '@pages/collection/services/helper.service';

@Component({
  selector: 'wen-collection-card',
  templateUrl: './collection-card.component.html',
  styleUrls: ['./collection-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionCardComponent {
  @Input() public collection?: Collection;
  @Input() fullWidth?: boolean;
  public path = ROUTER_UTILS.config.collection.root;

  constructor(
    private cache: CacheService,
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public helper: HelperService
  ) {
    // none.
  }

  public get space(): Space | undefined {
    if (!this.collection?.space) {
      return undefined;
    }

    const space: Space | undefined = this.cache.allSpaces$.value.find((s) => {
      return s.uid === this.collection!.space;
    });

    return space;
  }
  public get spaceAvatarUrl(): string | undefined {
    if (this.space) {
      return this.space.avatarUrl ? FileApi.getUrl(this.space.avatarUrl, 'space_avatar', FILE_SIZES.small) : undefined;
    }

    return undefined;
  }

  public get targetAccess(): typeof Access {
    return Access;
  }

  public getStatusProperties(): { label: string; className: string } {
    if (this.collection?.approved !== true && this.collection?.rejected !== true) {
      return {
        label: $localize`Pending approval`,
        className: 'bg-tags-commencing dark:bg-tags-commencing-dark'
      };
    } else if (this.collection?.approved) {
      return {
        label: $localize`Available`,
        className: 'bg-tags-available dark:bg-tags-available-dark'
      };
    } else {
      return {
        label: $localize`Rejected`,
        className: 'bg-tags-closed dark:bg-tags-closed-dark'
      };
    }
  }
}
