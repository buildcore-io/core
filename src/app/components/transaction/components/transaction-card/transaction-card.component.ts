import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';
import { TransactionService } from '@core/services/transaction';
import { UnitsHelper } from '@core/utils/units-helper';
import { Transaction } from '@functions/interfaces/models';

@Component({
  selector: 'wen-transaction-card',
  templateUrl: './transaction-card.component.html',
  styleUrls: ['./transaction-card.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionCardComponent {
  @Input() transaction!: Transaction;

  constructor(
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService,
    public transactionService: TransactionService
  ) {}
  
  public formatBest(amount: number | undefined | null): string {
    if (!amount) {
      return '';
    }

    return UnitsHelper.formatBest(amount, 2);
  }
}
