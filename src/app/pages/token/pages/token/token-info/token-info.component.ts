import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreviewImageService } from '@core/services/preview-image';

@Component({
  selector: 'wen-token-info',
  templateUrl: './token-info.component.html',
  styleUrls: ['./token-info.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenInfoComponent {

  constructor(
    public previewImageService: PreviewImageService
  ) {}
}
