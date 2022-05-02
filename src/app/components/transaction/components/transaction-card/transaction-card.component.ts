import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';

@Component({
  selector: 'wen-transaction-card',
  templateUrl: './transaction-card.component.html',
  styleUrls: ['./transaction-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionCardComponent {
  // TODO: delete this
  public d = new Date();

  constructor(
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService
  ) {}
}
