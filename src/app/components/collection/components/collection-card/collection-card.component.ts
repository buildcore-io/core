import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FileApi } from '@api/file.api';
import { CacheService } from '@core/services/cache/cache.service';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { Space } from 'functions/interfaces/models';
import { FILE_SIZES } from 'functions/interfaces/models/base';
import { Collection, CollectionAccess } from 'functions/interfaces/models/collection';

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
    public previewImageService: PreviewImageService
  ) {
    // none.
  }

  public get space(): Space|undefined {
    if (!this.collection?.space) {
      return undefined;
    }

    const space: Space | undefined = this.cache.allSpaces$.value.find((s) => {
      return s.uid === this.collection!.space;
    });

    return space;
  }
  public get spaceAvatarUrl(): string|undefined {
    if (this.space) {
      return this.space.avatarUrl ? FileApi.getUrl(this.space.avatarUrl, 'space_avatar', FILE_SIZES.small) : undefined;
    }

    return undefined;
  }

  public get targetAccess(): typeof CollectionAccess {
    return CollectionAccess;
  }

  // Needs to be implemented
  public getStatus(): string {
    if (this.collection?.approved !== true && this.collection?.rejected !== true) {
      return 'Pending approval';
    } else if (this.collection?.approved) {
      return 'Available';
    } else {
      return 'Rejected';
    }
  }
}
