import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';
import { copyToClipboard } from '@core/utils/tools.utils';

export enum StepType {
  GENERATE = 'Generate',
  TRANSACTION = 'Transaction',
  WAIT = 'Wait',
  CONFIRMED = 'Confirmed'
}

@Component({
  selector: 'wen-iota-address',
  templateUrl: './iota-address.component.html',
  styleUrls: ['./iota-address.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IOTAAddressComponent {
  @Input() currentStep = StepType.GENERATE;
  
  public stepType = StepType;
  public isCopied = false;
  public address = '312301391293812309183xxxda90123103010sdasd0zc0xcasd00213';

  constructor(
    public deviceService: DeviceService
  ) {}

  public copyAddress() {
    if (!this.isCopied) {
      copyToClipboard(this.address)
      this.isCopied = true;
    }
  }
}
