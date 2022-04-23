import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';

export enum TokenCardType {
  UPCOMING = 0,
  ONGOING = 1,
  ENDING = 2
}

@Component({
  selector: 'wen-token-card',
  templateUrl: './token-card.component.html',
  styleUrls: ['./token-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenCardComponent {
  public cardType = TokenCardType.ENDING;

  constructor(
    public deviceService: DeviceService,
    public previewImageService: PreviewImageService
  ) {}

  public get tokenCardTypes(): typeof TokenCardType {
    return TokenCardType;
  }
}
