import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DeviceService } from '@core/services/device';
import { PreviewImageService } from '@core/services/preview-image';

@Component({
  selector: 'wen-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionsPage {
  public transactions = [
    { item: 'SoonLabs Token', amount: 500, type: 'Purchase', date: new Date(), link: 'https://www.google.com/' },
    { item: 'IOTABOTS Token', amount: 100, type: 'Bid', date: new Date(), link: 'https://www.google.com/' },
    { item: 'SoonLabs Token', amount: 500, type: 'Refund', date: new Date(), link: 'https://www.google.com/' },
    { item: 'IOTABOTS Token', amount: 100, type: 'Sell', date: new Date(), link: 'https://www.google.com/' }
  ];
  public includeBidsControl: FormControl = new FormControl(false);

  constructor(
    public previewImageService: PreviewImageService,
    public deviceService: DeviceService
  ) { }

  // TODO: needs to be implemented
  public onScroll(): void {
    return;
  }

  // TODO: will be implemented once table is filled with correct data
  public exportTransactions(): void {
    return;
  }
}
