import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FileApi } from '@api/file.api';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { FILE_SIZES } from 'functions/interfaces/models/base';
import { Collection } from 'functions/interfaces/models/collection';

@Component({
  selector: 'wen-collection-card',
  templateUrl: './collection-card.component.html',
  styleUrls: ['./collection-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionCardComponent {
  @Input() public collection?: Collection;
  public path = ROUTER_UTILS.config.collection.root;

  public get bannerUrl(): string|undefined {
    return this.collection?.bannerUrl ? FileApi.getUrl(this.collection.bannerUrl, 'collection_banner', FILE_SIZES.medium) : undefined;
  }

  // Needs to be implemented
  public get spaceAvatarUrl(): string|undefined {
    return '';
    // return this.space?.avatarUrl ? FileApi.getUrl(this.space.avatarUrl, 'space_avatar', FILE_SIZES.small) : undefined;
  }
}
