import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreviewImageService } from '@core/services/preview-image';
import { DataService } from '@pages/token/services/data.service';

@Component({
  selector: 'wen-token-info',
  templateUrl: './token-info.component.html',
  styleUrls: ['./token-info.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TokenInfoComponent {

  constructor(
    public previewImageService: PreviewImageService,
    public data: DataService
  ) {}
}
