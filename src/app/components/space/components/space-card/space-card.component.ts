import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FileApi } from '@api/file.api';
import { Space } from "functions/interfaces/models";
import { FILE_SIZES } from "../../../../../../functions/interfaces/models/base";
import { ROUTER_UTILS } from './../../../../@core/utils/router.utils';

@Component({
  selector: 'wen-space-card',
  templateUrl: './space-card.component.html',
  styleUrls: ['./space-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpaceCardComponent {
  @Input() public space?: Space;
  public path = ROUTER_UTILS.config.space.root;

  public get avatarUrl(): string|undefined {
    return this.space?.avatarUrl ? FileApi.getUrl(this.space.avatarUrl, 'space_avatar', FILE_SIZES.small) : undefined;
  }

  public get bannerUrl(): string|undefined {
    return this.space?.bannerUrl ? FileApi.getUrl(this.space.bannerUrl, 'space_banner', FILE_SIZES.medium) : undefined;
  }
}
