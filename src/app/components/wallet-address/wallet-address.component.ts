import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DeviceService } from '@core/services/device';

export enum AddressType {
  IOTA = 'IOTA'
}

@Component({
  selector: 'wen-wallet-address',
  templateUrl: './wallet-address.component.html',
  styleUrls: ['./wallet-address.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WalletAddressComponent {
  @Input() type = AddressType.IOTA;

  public isVerifyAddressOpen = false;
  public addressTypes = AddressType;

  constructor(
    public deviceService: DeviceService
  ) {}

  public getModalWidth(): string {
    switch (this.type) {
      case AddressType.IOTA:
        return '720px';
      default:
        return '720px';
    }
  }
}
