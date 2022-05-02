import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { ROUTER_UTILS } from '@core/utils/router.utils';
import { DataService } from '@pages/token/services/data.service';

@Component({
  selector: 'wen-token',
  templateUrl: './token.page.html',
  styleUrls: ['./token.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenPage {
  public sections = [
    { route: [ROUTER_UTILS.config.token.overview], label: $localize`Overview` },
    { route: [ROUTER_UTILS.config.token.metrics], label: $localize`Metrics` },
    { route: [ROUTER_UTILS.config.token.airdrops], label: $localize`Airdrops` }
  ];
  public isTokenInfoVisible = false;
  public isBuyTokensVisible = false;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService,
    public data: DataService
  ) {}

  public getShareUrl(): string {
    return window.location.href;
  }
}
